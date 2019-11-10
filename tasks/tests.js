'use strict';

module.exports = function(grunt) {
  grunt.registerTask('performance-update', function(version) {
    function copyMaster(callback) {
      grunt.util.spawn({
        cmd: 'git',
        args: ['show', 'master:build/ical.js']
      }, function(error, result, code) {
        grunt.file.write(filepath, header + result.stdout + footer);
        callback();
      });
    }

    var filepath = 'build/benchmark/ical_' + version + '.js';
    var header = "var ICAL_" + version + " = (function() { var ICAL = {};\n" +
                 "if (typeof global !== 'undefined') global.ICAL_" + version + " = ICAL;\n";
    var footer = "\nreturn ICAL; }());";

    if (!version) {
      grunt.fail.fatal('Need to specify build version name or "upstream" as parameter');
    } else if (version == "upstream") {
      var done = this.async();
      grunt.util.spawn({
        cmd: 'git',
        args: ['diff', '--shortstat'],
      }, function(error, result, code) {
        if (result.stdout.length) {
          grunt.log.ok('There are git changes, also comparing against master branch');
          copyMaster(done);
        } else {
          grunt.util.spawn({
            cmd: 'git',
            args: ['symbolic-ref', 'HEAD']
          }, function(error, result, code) {
            var branch = result.stdout.replace('refs/heads/', '');
            if (branch == 'master') {
              grunt.log.ok('No git changes, not comparing against master branch');
              grunt.file.delete(filepath);
              done();
            } else {
              grunt.log.ok('Not on master, also comparing against master branch');
              copyMaster(done);
            }
          });
        }
      });
    } else {
      grunt.file.copy('build/ical.js', filepath, {
        process: function(contents) {
          return header + contents + footer;
        }
      });
      grunt.log.ok('Successfully created ' + filepath);
    }
  });

  grunt.registerTask('test-node', function(arg) {
    if (!arg || arg == 'performance') {
      grunt.task.run('performance-update:upstream');
    }

    if (grunt.option('debug')) {
      var done = this.async();
      var open = require('biased-opener');
      open('http://127.0.0.1:8080/debug?port=5858', {
          preferredBrowsers : ['chrome', 'chromium', 'opera']
        }, function(err, okMsg) {
          if (err) {
             // unable to launch one of preferred browsers for some reason
             console.log(err.message);
             console.log('Please open the URL manually in Chrome/Chromium/Opera or similar browser');
          }
          done();
      });
      grunt.task.run('concurrent:' + (arg || "all"));
    } else if (arg) {
      grunt.task.run('mochacli:' + arg);
    } else {
      grunt.task.run('mochacli:performance');
      grunt.task.run('mochacli:acceptance');
      grunt.task.run('mochacli:unit');
    }
  });

  grunt.registerTask('injectIntoLightning', function(xpi) {
    var Zip = require("adm-zip");
    var fs = require("fs");
    var path = require("path");
    var unidiff = require("unidiff");

    if (!xpi) {
      grunt.fail.fatal("Must pass path to a zip file");
    }

    try {
      let zipfile = new Zip(xpi);
      let entry = zipfile.getEntry("modules/ical.js");
      let original = zipfile.readAsText(entry);

      let marker = "// -- start ical.js --\n";
      let markerPos = original.indexOf(marker);
      if (markerPos < 0) {
        throw new Error(`Could not find marker in ${xpi}!/modules/ical.js`);
      }

      let buildfile = fs.readFileSync(path.join("build", "ical.js"), "utf-8");
      let updated = original.substr(0, markerPos + marker.length) + buildfile;

      console.log(unidiff.diffAsText(original, updated, {
        aname: "zipfile/modules/ical.js",
        bname: "generated/modules/ical.js",
        context: 4,
      }));

      zipfile.updateFile(entry, Buffer.from(updated, "utf-8"));
      zipfile.writeZip();
    } catch (e) {
      grunt.fail.fatal(e);
    }
  })
};
