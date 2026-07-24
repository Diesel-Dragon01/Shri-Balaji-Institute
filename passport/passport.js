const passport = require('passport');
const LocalStrategy = require('passport-local');
const UserModel = require('../models/User.model');
const bcrypt = require('bcrypt');
var GoogleStrategy = require('passport-google-oauth20').Strategy;


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:4444/auth/google/callback"
},
    async function (accessToken, refreshToken, profile, cb) {
        console.log("AT", accessToken);
        // console.log("RT", refreshToken);
        console.log("Profile", profile);
        try {
            let user = await UserModel.findOne({
                googleid: profile.id
            })

            if(user) return cb(null, user);
    
            user = await UserModel.create({
                username: profile.displayName,
                email: profile.emails?.[0]?.value || "",
                password: Date.now().toString(),
                accessToken,
                profileImage: profile.photos[0]?.value || "",
                googleid: profile.id
            });
            return cb(null, user);
        } catch (error) {
            return cb(error);
        }
    }
));

passport.serializeUser(function (user, done) {
    done(null, user._id.toString());
});

passport.deserializeUser(async function (_id, done) {
    try {
        let user = await UserModel.findOne({
            _id
        });

        done(null, user);
    } catch (error) {
        done(error);
    }
});

passport.use(new LocalStrategy(
    async function (username, password, done) {
        try {
            let user = await UserModel.findOne({
                username
            })

            if (!user) { return done(null, false); }

            bcrypt.compare(password, user.password).then(function (result) {
                if (result == false) {
                    return done(null, false);
                }

                done(null, user);
            });
        } catch (error) {
            done(error);
        }
    }
));

module.exports = passport;