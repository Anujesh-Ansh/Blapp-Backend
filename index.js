const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadCoverImage = multer({ dest: 'uploads/' });

const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'mysecret';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: ['http://localhost:3000', 'http://localhost:8081'] // Allow both React.js and React Native
}));
app.use('/uploads', express.static(__dirname+'/uploads'));

mongoose.connect('mongodb+srv://anshanujesh:admin@cluster0.rinhjc8.mongodb.net/');
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    console.log(`New user created with username: ${username}`);
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'An error occurred' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    if (!userDoc) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      const token = jwt.sign({ username, id: userDoc._id }, secret);
      res.cookie('token', token).json({
        id: userDoc._id,
        username,
      });
      console.log(`Logged in: ${username}`);
    } else {
      res.status(400).json({ error: 'Wrong Credentials' });
    }
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'An error occurred' });
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret,{}, (err, info) => {
    if (err) {
      console.error(err);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.clearCookie('token').json('ok');
});


app.post('/logout', (req, res) => {
  res.clearCookie('token').json('ok');
});

app.post('/post', uploadCoverImage.single('files'), async (req, res) => {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = `${path}.${ext}`;
    fs.renameSync(path, newPath);


    const {token} = req.cookies;
    jwt.verify(token, secret, {},async (err, info) => {
      if (err) throw err;

      const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      image:newPath,
      author:info.id,
    });

    // res.json(info.username);
    res.json({ postDoc });

      
    });
  })

app.get('/test', (req, res) => {
  res.json('test okie');
});

app.put('/post', uploadCoverImage.single('files'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = `${path}.${ext}`;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      console.error(err);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, title, summary, content } = req.body;
    try {
      const postDoc = await Post.findById(id);

      if (!postDoc) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const isAuthor = String(postDoc.author) === String(info.id);

      if (!isAuthor) {
        return res.status(403).json({ error: 'You are not the author of this post' });
      }

      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.image = newPath ? newPath : postDoc.image;

      await postDoc.save(); // Save changes to the post

      res.json(postDoc); // Return the updated post
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});


app.get('/post', async (req, res) => {
  res.json(await Post.find().populate('author',['username']));
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const PostDoc = await Post.findById(id).populate('author',['username']);
  res.json(PostDoc);
})

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
