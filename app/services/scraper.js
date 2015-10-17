var cheerio = require('cheerio');
var http = require('http');
var _ = require('lodash');
var request = require('request');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var Program = require('../models/program.js');

// We need finnish localization
var moment = require('moment-timezone');
moment.locale('fi');

var baseUrl = "http://www.telsu.fi/";
var channels = ["yle1","yle2","mtv3","nelonen","subtv","liv","jim","viisi","kutonen","fox","ava","hero"];
// var channels = ["yle1","yle2","mtv3"];
var content = "";
var descriptions = [];
var names = [];
var seasons = [];
var episodes = [];
var starts = [];
var ends = [];

var allPrograms = [];

function searchSeasonNumber(description) {

  var start = description.indexOf("Kausi");
  var number;

  if(description.charAt(start+8) !== '.') {
    number = description.substr(start+6,1);
  } else {
    number = description.substr(start+6,2);
  }

  if(isNaN(number/1)) {
    return '-';
  } else {
    return number;
  }
}

function searchEpisodeNumber(description) {

  var start = description.indexOf("Jakso");
  var number;

  if(description.charAt(start+8) !== '/') {
    number = description.substr(start+6,1);
    //console.log("Jakso " + number);
  } else {
    number = description.substr(start+6,2);
    //console.log("Jakso " + number);
  }

  if(isNaN(number/1)) {
    return '-';
  } else {
    return number;
  }
}

function searchProgramName(summary) {

  var start = summary.indexOf("(");

  if(typeof(start) !== undefined) {
    var name = summary.substr(0,start-1);
    return name;
  } else {
    return summary;
  }
}

function getSeriesIDs() {

  _.map(allPrograms, function(channel,index) {
    _.map(channel.data, function(series) {

      var name = series.name;
      var url = "http://thetvdb.com/api/GetSeries.php?seriesname="+name+"&language=fi";

      request(url, function(name) { return function(err,res,body) {

        if(res.statusCode === 200) {

          $ = cheerio.load(body, { xmlMode: true });
          var seriesid = $('Series').find('seriesid').text();

          if(seriesid.substr(0,6) === seriesid.substr(6,6)) {
            seriesid = seriesid.substr(0,6);
          } else if(seriesid.substr(0,5) === seriesid.substr(5,5)) {
            seriesid = seriesid.substr(0,5);
          } else if(seriesid.length % 5 === 0) {
            seriesid = seriesid.substr(0,5);
          } else {
            seriesid = seriesid.substr(0,6);
          }

          //console.log(channel.channelName + " " + name + ": " + seriesid);
          series.seriesid = seriesid;

          var newProgram = new Program();

          newProgram.channelName = channel.channelName;
          newProgram.data.name = series.name;
          newProgram.data.description = series.description;
          newProgram.data.season = series.season;
          newProgram.data.episode = series.episode;
          newProgram.data.start = series.start;
          newProgram.data.end = series.end;
          newProgram.data.seriesid = series.seriesid;

          newProgram.save(function(err) {
            if(err) throw err;
          });

        }

      }}(name));
    });
  });
}


// Gets information for every channel
function processBaseInformation(body, channelName) {

  // allPrograms.length = 0;
  descriptions.length = 0;
  names.length = 0;
  seasons.length = 0;
  episodes.length = 0;
  starts.length = 0;
  ends.length = 0;

  $ = cheerio.load(body);

  $('._summary').each(function(i,elem) {
    var programName = searchProgramName($(this).text());
    names[i] = programName;
  });

  $('._description').each(function(i,elem) {

    var description = $(this).text();

    if(description.length === 0) {
      descriptions[i] = "Ei kuvausta saatavilla.";
    } else {
      descriptions[i] = description;
      seasons[i] = searchSeasonNumber(description);
      episodes[i] = searchEpisodeNumber(description);
    }
  });

  $('._start').each(function(i,elem) {
    starts[i] = $(this).text();
  });

  $('._end').each(function(i,elem) {
    ends[i] = $(this).text();
  });

  var programs = [];

  // this combines information to JSON
  for(var i = 0; i < names.length; ++i) {

    var name = names[i];
    var description = descriptions[i];
    var season = seasons[i];
    var episode = episodes[i];
    var start = starts[i];
    var end = ends[i];

    var temp = {
      name: name,
      description: description,
      season: season,
      episode: episode,
      start: start,
      end: end
    };

    programs.push(temp);

  }

  var temp = {
    channelName: channelName,
    data: programs
  };

  console.log(allPrograms.length + " === " + channels.length);

  allPrograms.push(temp);

  if(allPrograms.length === channels.length) {
    console.log("all channels processed");
    eventEmitter.emit('base_finished');
  }
}


module.exports = {

  scrape: function () {

    allPrograms.length = 0;
    descriptions.length = 0;
    names.length = 0;
    seasons.length = 0;
    episodes.length = 0;
    starts.length = 0;
    ends.length = 0;

    Program.remove().exec();
    // There is expires field so documents older than 2 days will expire automatically

    var today = moment().tz('Europe/Helsinki').format('dddd');
    console.log(today);

    // var channels = ["yle1","yle2","mtv3","nelonen","subtv","liv","jim","viisi","kutonen","fox","ava","hero"];

    request("http://www.telsu.fi/"+today+"/yle1", function(err, res, body) {

      processBaseInformation(body, "yle1");

      request("http://www.telsu.fi/"+today+"/yle2", function(err, res, body) {

        processBaseInformation(body, "yle2");

        request("http://www.telsu.fi/"+today+"/mtv3", function(err, res, body) {

          processBaseInformation(body, "mtv3");

          request("http://www.telsu.fi/"+today+"/nelonen", function(err, res, body) {

            processBaseInformation(body, "nelonen");

            request("http://www.telsu.fi/"+today+"/subtv", function(err, res, body) {

              processBaseInformation(body, "subtv");

              request("http://www.telsu.fi/"+today+"/liv", function(err, res, body) {

                processBaseInformation(body, "liv");

                request("http://www.telsu.fi/"+today+"/jim", function(err, res, body) {

                  processBaseInformation(body, "jim");

                  request("http://www.telsu.fi/"+today+"/viisi", function(err, res, body) {

                    processBaseInformation(body, "viisi");

                    request("http://www.telsu.fi/"+today+"/kutonen", function(err, res, body) {

                      processBaseInformation(body, "kutonen");

                      request("http://www.telsu.fi/"+today+"/fox", function(err, res, body) {

                        processBaseInformation(body, "fox");

                        request("http://www.telsu.fi/"+today+"/ava", function(err, res, body) {

                          processBaseInformation(body, "ava");

                          request("http://www.telsu.fi/"+today+"/hero", function(err, res, body) {

                            processBaseInformation(body, "hero");

                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    eventEmitter.once('base_finished', function() {
      getSeriesIDs();
    });

  }
}
