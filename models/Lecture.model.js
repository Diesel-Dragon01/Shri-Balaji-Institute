const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
    classNum: { type: Number, required: true },   // 1–12
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    videoId: { type: String, required: true },      // the YouTube video ID, e.g. "dQw4w9WgXcQ"
                                                    // (from a URL like youtube.com/watch?v=dQw4w9WgXcQ)
    thumbnail: String,                              // optional override; falls back to YouTube's own thumbnail
    duration: Number,                               // seconds, optional — just for display
    order: { type: Number, default: 0 },            // controls sort order within a subject
    tier: { type: String, enum: ['basic', 'premium', 'developer'], default: 'premium' }
}, { timestamps: true });

module.exports = mongoose.model('Lecture', lectureSchema);