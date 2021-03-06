const moment = require('moment-timezone');

const http = require('../helpers/http');
const mongo = require('../helpers/mongo');

const baseUrl = 'https://json.xmltv.se';
const dateString = () => moment().tz('Europe/Helsinki').format('YYYY-MM-DD');

const { channelsByCountry } = require('../data/channels');

const xmltvOptions = { headers: { 'content-type': 'application/octet-stream' } };

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
  if (parts.length === 1) {
    return '-';
  }
  const episodeStr = parts[1].trim();
  const episode = episodeStr.includes('/') ? episodeStr.split('/')[0].trim() : episodeStr.trim();
  return parseInt(episode, 10) + 1;
};

const getSeasonNumber = (str) => {
  const parts = str.split('.');
  if (parts.length === 1) {
    return '-';
  }
  const seasonStr = parts[0].trim();
  const season = seasonStr.includes('/') ? seasonStr.split('/')[0].trim() : seasonStr.trim();
  return parseInt(season, 10) + 1;
};

const getTitleOrDesc = (obj) => {
  let key;
  try {
    [key] = Object.keys(obj);
  } catch (error) {
    key = null;
  }
  return obj && key ? obj[key] : '';
};

const insertPrograms = async (data, _channelId) => {
  const programs = data.jsontv.programme.map(({
    title, desc, episodeNum, start, stop, category,
  }) => ({
    _channelId,
    data: {
      name: getTitleOrDesc(title),
      description: getTitleOrDesc(desc),
      season: episodeNum && episodeNum.xmltv_ns ? getSeasonNumber(episodeNum.xmltv_ns) : '-',
      episode: episodeNum && episodeNum.xmltv_ns ? getEpisodeNumber(episodeNum.xmltv_ns) : '-',
      start: start ? parseInt(start, 10) : '-',
      end: stop ? parseInt(stop, 10) : '-',
      categories: category && category.en ? category.en : [],
    },
  }));

  // bulk insert fails if array is empty
  if (!programs.length) {
    return;
  }

  const db = await mongo.db;
  await db.collection('programs').insertMany(programs);
};

const toResultObject = async (promise) => {
  const result = await promise
    .catch((error) => console.error('error with', error.req.path));

  return result;
};

async function updateSchedule() {
  const db = await mongo.db;
  await db.collection('programs').deleteMany({});
  const channels = await db.collection('channels').find({}).toArray();

  const promises = channels
    .map((channel) => http.get(`${baseUrl}/${channel._id}_${dateString()}.json.gz`, xmltvOptions))
    .map(toResultObject);

  const results = (await Promise.all(promises)).filter((res) => res);

  return Promise.all(results.map((channel, index) => insertPrograms(channel, channels[index]._id)));
}

/* processes an array of { jsontv: { channels: {} } } objects into one flat object */
function reduceChannels(result) {
  if (!Array.isArray(result)) {
    return {};
  }

  return result.reduce((acc, curr) => ({
    ...acc,
    ...(curr.jsontv && curr.jsontv.channels) || {},
  }), {});
}

const updateChannels = async () => {
  const db = await mongo.db;
  const countries = await db.collection('countries').find({}).toArray();
  const getChannel = (name) => http.get(`${baseUrl}/channels-${name}.json.gz`, xmltvOptions);
  const promises = countries.map(({ name }) => getChannel(name));

  const allChannels = reduceChannels(await Promise.all(promises));
  const channels = Object.keys(allChannels).map((channelId) => ({
    name: allChannels[channelId].displayName && allChannels[channelId].displayName.en,
    icon: allChannels[channelId].icon,
    _id: channelId,
    country: channelId.slice(channelId.lastIndexOf('.') + 1),
    get orderNumber() {
      return channelsByCountry[this.country] && channelsByCountry[this.country][this._id];
    },
  }));

  await db.collection('channels').deleteMany({});
  await db.collection('channels').insertMany(channels);
};

const updateAll = async () => {
  try {
    await updateChannels();
    console.log('Channels updated');
    await updateSchedule();
    console.log('Programs updated');
  } catch (error) {
    console.log(error.stack);
    console.log('update failed');
  }
};

module.exports = {
  updateSchedule,
  updateChannels,
  getEpisodeNumber,
  getSeasonNumber,
  updateAll,
  reduceChannels,
  toResultObject,
  insertPrograms,
};
