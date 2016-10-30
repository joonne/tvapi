// controllrs/program.js

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router(); // eslint-disable-line
const Program = mongoose.model('Program');

module.exports = (app) => {
    app.use('/', router);
};

router.get('/api/programs/:channel', (req, res) => {
    const channel = req.params.channel;

    Program.find({
        channelName: channel,
    }).sort({
        'data.start': 1,
    }).exec((err, programs) => {
        if (programs) {
            return res.status(200).json(programs);
        }
        return res.status(404).json({
            error: 'channel not found',
        });
    });
});

router.get('/api/programs', (req, res, next) => {
    Program.find({}, (err, programs) => {
        if (err) return next(err);
        return res.status(200).json(programs);
    });
});