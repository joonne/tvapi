const rp = require('request-promise');
const moment = require('moment-timezone');

const mongo = require('../helpers/mongo');

const baseUrl = 'http://json.xmltv.se';

const dateString = moment().tz('Europe/Helsinki').format('YYYY-MM-DD');

const language = 'fi';

/* xmltv_ns: This is intended to be a general way to number episodes and
parts of multi-part episodes.  It is three numbers separated by dots,
the first is the series or season, the second the episode number
within that series, and the third the part number, if the programme is
part of a two-parter.  All these numbers are indexed from zero, and
they can be given in the form 'X/Y' to show series X out of Y series
made, or episode X out of Y episodes in this series, or part X of a
Y-part episode.  If any of these aren't known they can be omitted.
You can put spaces whereever you like to make things easier to read. */

const getEpisodeNumber = (str) => {
  const parts = str.split('.');
  if (!parts.length) {
    return '-';
  }
  const episodeStr = parts[1].trim();
  const episode = episodeStr.includes('/') ? episodeStr.split('/')[0].trim() : episodeStr.trim();
  return parseInt(episode, 10) + 1;
};

const getSeasonNumber = (str) => {
  const parts = str.split('.');
  if (!parts.length) {
    return '-';
  }
  const seasonStr = parts[0].trim();
  const season = seasonStr.includes('/') ? seasonStr.split('/')[0].trim() : seasonStr.trim();
  return parseInt(season, 10) + 1;
};

const parseResponses = (responses) => {
  let parsed;
  try {
    parsed = responses.map(response => JSON.parse(response));
  } catch (error) {
    parsed = [];
  }
  return parsed;
};

const processBaseInformation = (data, _channelId) => {
  data.jsontv.programme.forEach((p) => {
    const program = {
      _channelId,
      data: {
        name: p.title && p.title[language] ? p.title[language] : '',
        description: p.desc && p.desc[language] ? p.desc[language] : '',
        season: p.episodeNum && p.episodeNum.xmltv_ns ? getSeasonNumber(p.episodeNum.xmltv_ns) : '-',
        episode: p.episodeNum && p.episodeNum.xmltv_ns ? getEpisodeNumber(p.episodeNum.xmltv_ns) : '-',
        start: p.start ? p.start : '-',
        end: p.stop ? p.stop : '-',
      },
    };

    mongo.getDb
      .then(db => db.collection('programs').insertOne(program));
  });
};

const updateSchedule = () => {
  let db;
  mongo.getDb
    .then((database) => {
      db = database;
      return db.collection('programs').deleteMany({});
    })
    .then(() => db.collection('channels').find().sort({ orderNumber: 1 }).toArray())
    .then((channels) => {
      const promises =
        channels.map(channel => rp(`${baseUrl}/${channel._id}.${language}_${dateString}.js.gz`));

      Promise.all(promises)
        .then(parseResponses)
        .then(results => results.forEach((channel, index) => {
          processBaseInformation(channel, channels[index]._id);
        }))
        .catch((err) => {
          console.log(err);
        });
    });
};

const updateChannels = () => {
  rp(`${baseUrl}/channels.js.gz`)
    .then((result) => {
      const channels = JSON.parse(result).jsontv.channels;
      Object.keys(channels).forEach((channelId) => {
        const channel = {
          name: channels[channelId].displayName.en,
          icon: channels[channelId].icon,
          _id: channelId,
          country: channelId.slice(channelId.lastIndexOf('.') + 1),
        };
        console.log(channel);
        let db;
        mongo.getDb
          .then((database) => {
            db = database;
            return db.collection('channels').deleteMany({});
          })
          .then(() => db.collection('channels').insertOne(channel));
      });
    });
};

updateChannels();

module.exports = {
  updateSchedule,
  updateChannels,
  getEpisodeNumber,
  getSeasonNumber,
};
