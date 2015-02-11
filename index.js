var nconf = require('nconf');
var cheerio = require('cheerio');
var request = require('request');
var path = require('path');
var jade = require('jade');
var CronJob = require('cron').CronJob;
var MailComposer = require("mailcomposer").MailComposer;
var Mailgun = require('mailgun').Mailgun;



// get user config
nconf.file('config.json');
var conf_zip = nconf.get('ZIPCODE') || bork('no ZIPCODE found in config.json');
var conf_range = nconf.get('MILERADIUS') || bork('no MILERADIUS found in config.json');
var conf_mailgunKey = nconf.get('MAILGUNKEY') || bork('no MAILGUNKEY found in config.json');
var conf_recipient = nconf.get('NOTIFYEMAIL') || bork('no NOTIFYEMAIL found in config.json');



// get program config
var upsUrl = 'http://jobs-ups.com/search/advanced-search/ASCategory/-1/ASPostedDate/-1/ASCountry/-1/ASState/-1/ASCity/-1/ASLocation/-1/ASCompanyName/-1/ASCustom1/-1/ASCustom2/-1/ASCustom3/-1/ASCustom4/-1/ASCustom5/-1/ASIsRadius/true/ASCityStateZipcode/' + conf_zip + '/ASDistance/' + (conf_range * 2) + '/ASLatitude/-1/ASLongitude/-1/ASDistanceType/Miles';
var sender = 'chris@grimtech.net';
var subject = 'ups-job-alerter ';
var footer = 'ups-job-alerter is free and open source software created by Chris Grimmett chris@grimtech.net. If you find this software useful, consider sending Chris some support, so he can make more FOSS products. https://github.com/insanity54/ups-job-alerter';



// init stuff
var mg = new Mailgun(conf_mailgunKey);
var mailcomposer = new MailComposer();



// functions
function randomToken() {
    return Math.floor(Math.random()*1000);
}

function checkUps() {
    console.log('checking ups');
    getUpsResultsPage(function(err, body) {
        if (err || !body) return console.error('error getting results ' + err);
        //console.log('got bodY: ');
        
        parseUpsResults(body, function(err, results) {
            if (err) return notifyUser(err);
            notifyUser(results, function(err) {
                if (err) return bork(err);
                return false
            });
        });
    });
};

/**
 * receives the entire body of the ups search result page.
 * outputs json containing
 *   - job title
 *   - job location
 *   - job zip code
 */
function parseUpsResults(body, cb) {
    $ = cheerio.load(body);
    
    var results = {};
    var jobs = [];
    
    //async.eachSeries(arr, iterator, callback)
    //.tableSearchResults > tbody:nth-child(2) > tr:nth-child(3)
    //console.log($(".tableSearchResults tr").html());
    
    $(".tableSearchResults tr").each(function (index) {
        if (index > 1) {  // every tr below 2 is a heading
        
            var job = {};
            $(this).find("td").each(function(i) {
                if (i == 0) {
                    job['title'] = $(this).text();
                    job['link'] = $(this).find("a").attr('href');
                }
                if (i == 1) job['location'] = $(this).text();
                if (i == 3) job['zip'] = $(this).text();
                //console.log('fart: [' + i + '] ' + $(this).html());
            });
            jobs.push(job);
        }
    });
    
    //console.log('jobz: ' + $("[id^=search_result_link_]").html());
    //console.log('jobs-- ' + jobs);
    
    results.jobs = jobs;
    return cb(null, results);

    
    // example results blob
    // {
    //     "jobs": [
    //         {
    //             "title": "package nadler",
    //             "location": "spokane, wa",
    //             "zip": "92383",
    //             "link": "http://ups.com/sdfsd/sdfsdf/"
    //         },
    //         {
    //             "title": "supervisor",
    //             "location": "spokane, wa",
    //             "zip": "92383"    
    //             "link": "http://ups.com/sdfsd/sdfsdf/"
    //         }
    //     ]
    // }
}

function getUpsResultsPage(cb) {
    request(upsUrl, function (err, res, body) {
      if (!err && res.statusCode == 200) {
          return cb(null, body);
      }
    });
}

function bork(err) {
    console.error('!!! BORK !!!');
    if (conf_mailgunKey && mg) return notifyUser(err);
    throw new Error(err);
}

function notifyUser(pageData, cb) {
    pageData['header'] = 'UPS Job Alert';
    pageData['message'] = 'Hello, user. Here are the available jobs at UPS: '
    pageData['footer'] = footer;
    var body = 'Hello, user. Here are the available jobs at UPS: ' + JSON.stringify(pageData) + '\n\n--\n\n' + footer;
    var html = jade.renderFile(path.join('mail_templates', 'alert.jade'), {pageData: pageData});
    mailcomposer.setMessageOption({
        from: sender,
        to: conf_recipient,
        body: body,
        html: html
    });

    console.log('notifying user ');
    mailcomposer.buildMessage(function(err, messageSource) {
        if (err) return mg.sendText(sender, conf_recipient, subject, 'System err. Could not build message using mailcomposer ' + err, cb);
        //console.log(err || messageSource);
        mg.sendRaw(sender, conf_recipient, messageSource, cb);
    });
    
    
}

function testMail() {
    
    var data = {
        jobs: [
            {
                title: "real cool guy",
                location: "nowhere",
                zip: "83838",
                link: "http://grimtech.net/"
            },
            {
                title: "sorta cool guy",
                location: 'somewhere',
                zip: "83839",
                link: "http://extremetoaster.com/"
            }
        ]
    }
    
    notifyUser(data, function(err) {
       if (err) return bork(err);
       return false
    });
}

// runner
var job = new CronJob('0 11,23 * * *', function() {
    // Runs every day at 11am and 11pm
    checkUps();
  },
  true /* Start the job right now */,
  "America/Los_Angeles"
);




//checkUps();
//testMail();