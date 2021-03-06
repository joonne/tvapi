// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');
const mongo = require('../../src/helpers/mongo');

let db;

const {
  getSeasonNumber,
  getEpisodeNumber,
  reduceChannels,
  toResultObject,
  insertPrograms,
} = require('../../src/services/xmltv');

/* Some examples will make things clearer.  The first episode of the
second series is '1.0.0/1' .  If it were a two-part episode, then the
first half would be '1.0.0/2' and the second half '1.0.1/2'.  If you
know that an episode is from the first season, but you don't know
which episode it is or whether it is part of a multiparter, you could
give the episode-num as '0..'.  Here the second and third numbers have
been omitted.  If you know that this is the first part of a three-part
episode, which is the last episode of the first series of thirteen,
its number would be '0 . 12/13 . 0/3'.  The series number is just '0'
because you don't know how many series there are in total - perhaps
the show is still being made! */

const clearDb = async () => {
  await db.collection('channels').removeMany({});
  await db.collection('programs').removeMany({});
};

describe('xmltv', () => {
  before(async () => {
    db = await mongo.db;
    clearDb();
  });
  after(clearDb);

  describe('getSeasonNumber', () => {
    it('should find a 1-digit season number from the given string', () => {
      [
        '1 . 3 .',
        '1.0.0/1',
        '1.0.0/2',
        '1.0.1/2',
        '1..',
        '1 . 12/13 . 0/3',
      ].forEach((string) => {
        getSeasonNumber(string).should.equal(2);
      });
    });

    it('should find a 2-digit season number from the given string', () => {
      [
        '12 . 3 .',
        '12.0.0/1',
        '12.0.0/2',
        '12.0.1/2',
        '12..',
        '12 . 12/13 . 0/3',
      ].forEach((string) => {
        getSeasonNumber(string).should.equal(13);
      });
    });

    it('should return "-" if the given string does not contain any dots.', () => {
      getSeasonNumber('12 0 0/2').should.equal('-');
    });
  });

  describe('getEpisodeNumber', () => {
    it('should find a 1 digit episode number from the given string', () => {
      [
        '1 . 3 .',
        '1.3.0/1',
        '1.3.0/2',
        '1.3.1/2',
        '.3.',
        '1 . 3/13 . 0/3',
      ].forEach((string) => {
        getEpisodeNumber(string).should.equal(4);
      });
    });

    it('should find a  2-digit episode number from the given string', () => {
      [
        '1 . 21 .',
        '1.21.0/1',
        '1.21.0/2',
        '1.21.1/2',
        '.21.',
        '1 . 21/22 . 0/3',
      ].forEach((string) => {
        getEpisodeNumber(string).should.equal(22);
      });
    });

    it('should return "-" if the given string does not contain any dots.', () => {
      getEpisodeNumber('1210/1').should.equal('-');
    });
  });

  describe('reduceChannels', () => {
    it('should return a flattened object that has the channel names as keys', () => {
      const channelName1 = 'mtv3.fi';
      const channelName2 = 'nelonen.fi';
      const validInput = [{
        jsontv: {
          channels: {
            [channelName1]: {},
          },
        },
      }, {
        jsontv: {
          channels: {
            [channelName2]: {},
          },
        },
      }];
      const expectedResult = {
        [channelName1]: {},
        [channelName2]: {},
      };
      reduceChannels(validInput).should.deep.equal(expectedResult);
    });

    it('should return an empty object if the given parameter is not an array', () => {
      [{}, '', 12].forEach((input) => reduceChannels(input).should.deep.equal({}));
    });
  });

  describe('toResultObject', () => {
    it('should resolve a given promise with correct value', async () => {
      const value = 'jee';
      const result = await toResultObject(Promise.resolve(value));
      result.should.equal(value);
    });

    it('should resolve a given to be rejected promise from xmltv with a falsy value', async () => {
      const errorResponse = { req: { path: '/' } };
      const result = await toResultObject(Promise.reject(errorResponse));
      expect(result).to.be.undefined;
    });
  });

  describe('insertPrograms', () => {
    it('should not insert any programs into db when there is no data (due to bulk insert restrictions)', async () => {
      const data = { jsontv: { programme: [] } };
      await insertPrograms(data, 'id');
      const result = await db.collection('programs').find({}).toArray();
      result.length.should.equal(0);
    });

    it('should insert 1 program into db', async () => {
      const data = {
        jsontv: {
          programme: [{
            title: 'title',
            description: 'description',
            episodeNum: { xmltv_ns: 'asd' },
            start: '123123123',
            stop: '123123123123',
            category: { en: [] },
          }],
        },
      };

      await insertPrograms(data, 'id');

      const result = await db.collection('programs').find({}).toArray();
      result.length.should.equal(1);
    });
  });
});
