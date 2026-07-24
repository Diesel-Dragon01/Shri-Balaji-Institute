const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcrypt');

let userSchema = new Schema({
    username: {
        type: String,
        required: true,
    },

    email: {
        type: String,
        default: ""
    },

    password: {
        type: String,
        required: true
    },

    accessToken: String,

    profileImage: String,

    googleid: {
        type: String,
        unique: true,
        sparse: true
    },

    tier: {
        type: String,
        default: "basic"
    },
    theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light"
    },
    bio: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

// Just before we are about to save our data in db, we can make changes
userSchema.pre('save', function () {
    const hash = bcrypt.hashSync(this.password, 10);
    this.password = hash;
});

module.exports = mongoose.model('User', userSchema);