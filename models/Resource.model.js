// models/Resource.model.js
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    classNum: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    driveLink: {
        type: String,
        required: true,
        trim: true
    },
    fileType: {
        type: String,
        enum: ["pdf", "doc", "other"],
        default: "pdf"
    },
    order: {
        type: Number,
        default: 0
    },
    tier: {
        type: String,
        enum: ["basic", "premium", "developer"],
        default: "premium"
    }
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
