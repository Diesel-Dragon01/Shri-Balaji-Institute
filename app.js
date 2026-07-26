require('dotenv').config(); // To enable read from .env file

const path = require('path');
const express = require('express');
const { default: mongoose } = require('mongoose');
const UserModel = require('./models/User.model');
const LectureModel = require('./models/Lecture.model');
const AccessLogModel = require('./models/AccessLog.model');
const app = express();
const PORT = process.env.PORT || 4444;
var Cookies = require('cookies')
const jwt = require('jsonwebtoken');
app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const session = require('express-session');
const hbs = require('hbs');
const multer = require("multer");
const fs = require("fs");
app.use(
    "/uploads",
    express.static(path.join(__dirname, "public", "uploads"))
);

hbs.registerHelper('equal', function (a, b) {
    return a === b;
});

// Partials live in views/partials — navbar, sidebar, footer, toast, shared-scripts
// NOTE: hbs.registerPartials converts hyphens in filenames to underscores when it
// registers the partial name, so the files are named base_styles.hbs / shared_scripts.hbs
// (not base-styles.hbs / shared-scripts.hbs) to match what templates reference.
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

const MongoDBStore = require('connect-mongodb-session')(session);
var store = new MongoDBStore({
    uri: process.env.MONGO_URI,
    collection: 'mySessions'
});

store.on('error', function (error) {
    console.log(error);
});


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true, 
    store: store, 
})); 

const passport = require('./passport/passport');

app.use(passport.initialize());
app.use(passport.session());


app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/dashboard');
    });

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user) => {

        if (!user) {
            return res.redirect('/?error=invalid');
        }

        req.login(user, (err) => {
            if (err) return next(err);

            return res.redirect('/dashboard');
        });

    })(req, res, next);
});

function isLoggedIn(req, res, next) {
    if (!req.user) return res.redirect('/');
    next();
}

const membershipNames = {
    basic: "Basic Member",
    premium: "Premium Member",
    developer: "Developer Member"
};

const DEFAULT_PROFILE_IMAGE = "https://i.pinimg.com/originals/b6/47/0b/b6470b72ee3ad6dc963ad5a5f792b264.jpg?nii=t";

app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render("dashboard", {
        username: req.user.username,
        profileImage: req.user.profileImage || DEFAULT_PROFILE_IMAGE,
        tier: req.user.tier,
        theme: req.user.theme,
        isGoogleUser: !!req.user.googleid,
        contactEmail: process.env.CONTACT_EMAIL,
        contactPhone: process.env.CONTACT_PHONE,
        country: "India, Delhi"
    });
})

app.get("/profile", isLoggedIn, (req, res) => {
    const membershipName = membershipNames[req.user.tier] || "Member";

    res.render("profile", {
        username: req.user.username,
        email: req.user.email,
        userId: req.user._id,
        joinedDate: req.user.createdAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }),
        profileImage: req.user.profileImage || DEFAULT_PROFILE_IMAGE,
        tier: req.user.tier,
        theme: req.user.theme,
        membershipName,
        bio: req.user.bio,
        isGoogleUser: !!req.user.googleid,
        contactEmail: process.env.CONTACT_EMAIL,
        contactPhone: process.env.CONTACT_PHONE,
        country: "India, Delhi"
    });
});

app.get('/settings', isLoggedIn, (req, res) => {
    res.render("settings", {
        username: req.user.username,
        profileImage: req.user.profileImage || DEFAULT_PROFILE_IMAGE,
        tier: req.user.tier,
        theme: req.user.theme,
        isGoogleUser: !!req.user.googleid,
        contactEmail: process.env.CONTACT_EMAIL,
        contactPhone: process.env.CONTACT_PHONE,
        country: "India, Delhi"
    });
});

app.get('/courses', isLoggedIn, (req, res) => {
    const isGoogleUser = !!req.user.googleid;
    const hasPremiumAccess = req.user.tier === 'premium' || req.user.tier === 'developer';

    if (!hasPremiumAccess) {
        if (!isGoogleUser) {
            return res.redirect('/dashboard?courses=google-required');
        }
        return res.redirect('/dashboard?courses=upgrade-required');
    }

    res.render("courses", {
        username: req.user.username,
        profileImage: req.user.profileImage || DEFAULT_PROFILE_IMAGE,
        tier: req.user.tier,
        theme: req.user.theme,
        isGoogleUser,
        contactEmail: process.env.CONTACT_EMAIL,
        contactPhone: process.env.CONTACT_PHONE,
        country: "India, Delhi"
    });
});

// Returns all lectures for a class, grouped by subject, filtered to what this user's tier can see.
app.get('/api/lectures/:classNum', isLoggedIn, async (req, res) => {
    try {
        const classNum = Number(req.params.classNum);
        if (!classNum || classNum < 1 || classNum > 12) {
            return res.status(400).json({ success: false, message: "❌ Invalid class." });
        }

        const tierRank = { basic: 0, premium: 1, developer: 2 };
        const userRank = tierRank[req.user.tier] ?? 0;

        const lectures = await LectureModel.find({ classNum }).sort({ subject: 1, order: 1 });
        const visible = lectures.filter(l => (tierRank[l.tier] ?? 1) <= userRank);

        const grouped = {};
        visible.forEach(lecture => {
            if (!grouped[lecture.subject]) grouped[lecture.subject] = [];
            grouped[lecture.subject].push(lecture);
        });

        // Log exactly which video IDs this user was handed, and when — lets you trace a leak
        // back to which accounts had access to that video around the relevant time.
        AccessLogModel.create({
            user: req.user._id,
            username: req.user.username,
            classNum,
            videoIds: visible.map(l => l.videoId),
            ip: req.ip
        }).catch(err => console.error("Access log failed:", err));

        res.json({ success: true, lectures: grouped });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "❌ Could not load lectures." });
    }
});

// Add a lecture — restricted to developer tier. No admin UI yet, so call this with
// Postman/curl while logged in as a developer-tier account, e.g.:
// POST /api/lectures  { "classNum": 10, "subject": "Mathematics", "title": "Real Numbers", "videoId": "dQw4w9WgXcQ" }
app.post('/api/lectures', isLoggedIn, async (req, res) => {
    if (req.user.tier !== 'developer') {
        return res.status(403).json({ success: false, message: "❌ Not authorized." });
    }

    try {
        const { classNum, subject, title, description, videoId, order, tier } = req.body;

        if (!classNum || !subject || !title || !videoId) {
            return res.status(400).json({ success: false, message: "❌ classNum, subject, title, and videoId are required." });
        }

        const lecture = await LectureModel.create({
            classNum, subject, title, description, videoId, order, tier
        });

        res.json({ success: true, message: "✅ Lecture added!", lecture });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "❌ Failed to add lecture." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/signup', async (req, res) => {
    try {
        console.log(req.body);

        const { username, password } = req.body;

        let existingUser = await UserModel.findOne({ username });

        if (existingUser) {
            return res.status(400).send("User already present");
        }

        const user = await UserModel.create({
            username,
            password
        });

        console.log("Created:", user);

        res.send("Signup successful");
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

app.get('/signup', (req, res) => {
    res.render('signup');
})

app.get('/upgrade', isLoggedIn, (req, res) => {

    if (req.user.tier !== 'basic') {
        return res.redirect('/dashboard');
    }

    if (!req.user.googleid) {
        return res.send("Premium upgrades require Google login");
    }

    res.render('upgrade', {
        username: req.user.username,
        tier: req.user.tier
    });
});

app.post('/upgrade-premium', isLoggedIn, async (req, res) => {

    await UserModel.findByIdAndUpdate(
        req.user._id,
        {
            tier: 'premium'
        }
    );

    res.redirect('/dashboard?premium=success');
});

app.post('/unsubscribe-premium', isLoggedIn, async (req, res) => {
    try {
        if (req.user.tier !== 'premium') {
            return res.status(400).json({
                success: false,
                message: "❌ You're not currently on Premium."
            });
        }

        await UserModel.findByIdAndUpdate(req.user._id, { tier: 'basic' });
        req.user.tier = 'basic';

        res.json({
            success: true,
            message: "🔻 Premium subscription cancelled — you're back on Basic."
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "❌ Something went wrong."
        });
    }
});

app.post('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.post("/update-profile", isLoggedIn, async (req, res) => {

    try {

        const { username, bio } = req.body;

        const updatedUser = await UserModel.findByIdAndUpdate(
            req.user._id,
            {
                username,
                bio
            },
            {
                new: true
            }
        );

        req.user.username = updatedUser.username;
        req.user.bio = updatedUser.bio;

        res.json({
            success: true,
            message: "✅ Profile updated successfully!"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "❌ Failed to update profile."
        });

    }

});

const bcrypt = require('bcrypt'); // npm install bcrypt, if not already installed

app.post('/change-password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "❌ Please fill in all fields."
            });
        }

        const user = await UserModel.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "❌ User not found."
            });
        }

        // Google-only accounts never set a local password
        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: "❌ This account signs in with Google and has no password to change."
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "❌ Current password is incorrect."
            });
        }

        // Set the plain new password and .save() — if your schema hashes
        // passwords in a pre('save') hook, this will hash it correctly.
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: "🔑 Password updated successfully!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "❌ Something went wrong."
        });
    }
});

app.post('/update-theme', isLoggedIn, async (req, res) => {
    try {
        const { theme } = req.body;

        if (!["light", "dark"].includes(theme)) {
            return res.status(400).json({
                success: false,
                message: "❌ Invalid theme value."
            });
        }

        await UserModel.findByIdAndUpdate(req.user._id, { theme });
        req.user.theme = theme;

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "❌ Failed to save theme."
        });
    }
});

// Notification preference toggles (Settings page — Email Notifications / Course Updates).
// NOTE: this assumes your User schema has `emailNotifications` and `courseUpdates`
// boolean fields. Add them to models/User.model.js if they aren't there yet, e.g.:
//   emailNotifications: { type: Boolean, default: true },
//   courseUpdates:      { type: Boolean, default: true },
app.post('/update-settings', isLoggedIn, async (req, res) => {
    try {
        const allowedKeys = ['emailNotifications', 'courseUpdates'];
        const updates = {};

        for (const key of allowedKeys) {
            if (key in req.body) updates[key] = !!req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "❌ Nothing to update."
            });
        }

        await UserModel.findByIdAndUpdate(req.user._id, updates);
        Object.assign(req.user, updates);

        res.json({
            success: true,
            message: "✅ Preference saved"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "❌ Failed to save preference."
        });
    }
});

// Logout on all devices — removes every session document that belongs to this user
// from the session store, then logs out the current request too.
// NOTE: this assumes passport's serializeUser stores the user's _id as a string at
// session.passport.user (the default). Also, `store.collection` is the raw MongoDB
// collection handle exposed by connect-mongodb-session — if you're on an older/newer
// version of that package and this property name has changed, check its docs/README
// for how to reach the underlying collection.
app.post('/logout-all', isLoggedIn, async (req, res) => {
    try {
        await store.collection.deleteMany({
            "session.passport.user": req.user._id.toString()
        });

        req.logout(function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "❌ Something went wrong."
                });
            }
            res.json({
                success: true,
                message: "🚪 Logged out on all devices."
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "❌ Could not log out other devices."
        });
    }
});

// To upload pics to the db from personal pc storage
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "./public/uploads");
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() + "-" + file.originalname;

        cb(null, uniqueName);
    }

});

const upload = multer({

    storage,

    fileFilter: (req, file, cb) => {

        const allowed = [
            "image/jpeg",
            "image/jpg",
            "image/png"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG and PNG images are allowed."));
        }
    },

    limits: {
        fileSize: 3 * 1024 * 1024
    }

});

app.post(
    "/upload-photo",
    isLoggedIn,
    upload.single("profilePhoto"),
    async (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select an image."
            });
        }

        const imagePath = "/uploads/" + req.file.filename;

        await UserModel.findByIdAndUpdate(
            req.user._id,
            { profileImage: imagePath }
        );

        req.user.profileImage = imagePath;

        res.json({
            success: true,
            image: imagePath
        });
    }
);

app.use((err, req, res, next) => {

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next();
});


mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(PORT, () => {
            console.log("Connected to:", mongoose.connection.name);
            console.log(`http://localhost:` + PORT);
        });
    })
    .catch(err => {
        console.log(err);
    })
