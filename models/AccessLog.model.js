const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: String,          // denormalized so logs are still readable even if the user is later deleted
    classNum: Number,
    videoIds: [String],        // every lecture ID this request exposed to the user
    ip: String
}, { timestamps: true });

module.exports = mongoose.model('AccessLog', accessLogSchema);
