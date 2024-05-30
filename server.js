const express = require('express');
const app = express();
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo');

app.set('view engine', 'ejs');

app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(
    session({
        secret: 'qwer1234',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 60 * 60 * 1000 },
        store: MongoStore.create({
            mongoUrl: '이곳에 db 주소를 입력하세요.',
            dbName: 'opensource_project',
        }),
    })
);

app.use(passport.session());

let db;
const url = '이곳에 db 주소를 입력하세요.';
new MongoClient(url)
    .connect()
    .then((client) => {
        console.log('Connection to database was successful.');
        db = client.db('opensource_project');

        app.listen(8080, () => {
            console.log('Server running at http://localhost:8080');
        });
    })
    .catch((err) => {
        console.log(err);
    });

app.get('/', (req, res) => {
    res.render('login.ejs')
});

// DB에 저장되어 있는 모든 user에 대한 정보를 확인하기 위한 API
app.get('/list', async function (req, res) {
    let result = await db.collection('user').find().toArray();
    res.send(result);
});

// 회원 가입 form을 전송하는 API
app.get('/sign-up', (req, res) => {
    res.render('signup.ejs');
});

// 회원 가입 요청을 처리하는 API
app.post('/sign-up', (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let genres = req.body.genres

    db.collection('user').insertOne({
        username: username,
        password: password, // 이후, 보안을 위한 해시를 적용할 필요있음
        genres : genres
    });

    res.redirect('/')
});

// passport 라이브러리 사용하여 log-in 처리
passport.use(
    new LocalStrategy(async (userId, password, cb) => {
        let result = await db.collection('user').findOne({ username: userId });
        if (!result) {
            return cb(null, false, { message: '아이디가 존재하지 않습니다.' });
        }
        if (result.password == password) {
            return cb(null, result);
        } else {
            return cb(null, false, { message: '비밀번호가 일치하지 않습니다.' });
        }
    })
);

// 세션 생성 후 쿠키 전송
passport.serializeUser((user, done) => {
    process.nextTick(() => {
        done(null, { id: user._id, username: user.username });
    });
});

// http 요청 메세지의 쿠키 확인
passport.deserializeUser((user, done) => {
    process.nextTick(() => {
        return done(null, user);
    });
});

// 로그인 폼을 요청하는 API
app.get('/log-in', (req, res) => {
    res.render('login.ejs');
});

// 로그인 요청을 처리하는 API
app.post('/log-in', (req, res, next) => {
    passport.authenticate('local', (error, user, info) => {
        if (error) return res.status(500).json(error);
        if (!user) return res.status(401).json(info.message);
        req.logIn(user, (err) => {
            if (err) return next(err);
            res.redirect('/main');
        });
    })(req, res, next);
});

app.get('/main', async (req, res) => {
    let result = await db.collection('user').findOne({ _id : new ObjectId(req.user.id) });
    let genres = result.genres
    res.render('main.ejs', {genres : JSON.stringify(genres)})
})

app.get('/my-page', async (req, res) => {
    let result = await db.collection('user').findOne({ _id : new ObjectId(req.user.id) });
    res.render('mypage.ejs')
})

// DB에 유저의 영화 정보 수정
app.post('/my-page', async (req, res) => {
    let updatedGenres = req.body.genres
    await db.collection('user').updateOne({_id : new ObjectId(req.user.id)}, {$set: {genres: updatedGenres}});
    res.render('main.ejs', { genres: JSON.stringify(updatedGenres) });
})
