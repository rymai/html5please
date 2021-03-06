// Native modules
var fs = require('fs');
var request = require('request'); 

// Third-party modules
var Backbone = require('backbone');
var Handlebars = require('handlebars');
var Markdown = require('node-markdown').Markdown;
var async = require('async');

//polyfill or no
Handlebars.registerHelper('polyfillaction', function(tags) {
  if(tags.indexOf('polyfill') > -1) 
    return 'with <b class=polyfill>polyfill</b>';
  if(tags.indexOf('fallback') > -1) return 'with <b class=fallback>fallback</b>';
  return false;
});

Handlebars.registerHelper('featuretag', function(feature) {
  var tag = /^<(.*)>/.exec(feature);
  if(tag) {
    return "&lt;" + tag[1] + ">";
  } else {
    return feature;
  }
});

Handlebars.registerHelper('testurl', function(url) {
  return  /caniuse/.exec(url) != null? 'View browser share %': 'Learn more';                  
});

// File paths
var paths = {
  output: './index.html',
  template: './template.html',
  posts: './posts',
  githuburl: 'https://github.com/h5bp/html5please/blob/master/posts/',
  caniuseurl: 'http://caniuse.com/',
};

// Tag Array
var featuretags = [];

// Ensures Backbone doesn't try to make a DOM element
Backbone.View.prototype._ensureElement = function() {};

exports.Feature = Backbone.Model.extend({
  initialize: function() {
    if (this.has("contents")) {
      var i, len, parts, key, val, posttags;
      var obj = { contents: '' };
      var docs = this.get('contents').split('\n\n');
      var lines = docs[0].split('\n');

      if(this.has('editfrag')) {
        obj.editurl = paths.githuburl + this.get('editfrag') + '.md';
        obj.slug = this.get('editfrag');
      }

      for (i = 0, len = lines.length; i < len; i++) {
        parts = lines[i].trim().split(':');
        
        if (parts.length < 2) {
          console.error(lines);
          throw new Error('Invalid key: val');  
        }
       
        key = parts[0];
        val = parts.slice(1).join(':').trim();
       
        if(key == 'tags') {
          posttags = val.split(' ');
          posttags.forEach(function(tag) {
            tag = tag.trim();
            if(tag && featuretags.indexOf(tag) == -1 && tag !== 'none') {
              featuretags.push(tag);
            }
          });
        }  
       
       if(key == 'kind') {
        obj.moreurl = paths.caniuseurl + obj.slug;
       } 
              
        obj[key] = (key === 'polyfillurls') ?  "" + Markdown(val) : "" + val.trim();
      }

      obj.contents = "" + Markdown(docs.slice(1).join("\n\n"));

       
      // Update the model to use the metadata and contents
      this.set(obj);
    }
  }
});

exports.Features = Backbone.Collection.extend({
  model: exports.Feature,

  sync: function(method, model, options) {
    var data = [];
    var files = fs.readdirSync(paths.posts);

    // Slice off the file extension for each
    files.forEach(function(file, i) {
      data.push({
        contents: fs.readFileSync(paths.posts + "/" + file).toString(),
        editfrag: file.slice(0, -3),
        id: i
      });
    });

    // Call success with the fetched data
    options.success(data);
  }
});

exports.Markup = Backbone.View.extend({
  initialize: function() {
    // Read in the template and compile via handlebars to a reusable
    // property that can be accessed in render.
    var source = fs.readFileSync(paths.template).toString();
    this.template = Handlebars.compile(source);    
  },

  // Triggered only when argument checkurls is passed to CLI
  updateurls: function(updateUrlCallback) {
    console.log('updating caniuse data');
    var collectionlength = this.collection.length;
    var eventcount = 0;
    var callback = callback;

    async.forEachSeries(
      this.collection.toArray(),      
      function(feature, callback) {
      var req = request({
        method: 'GET',
        uri: feature.get('moreurl'),
        headers: {
          'User-Agent': 'html5please'
        }
      }, function(error, response) {
        if(response.statusCode == 404) {
          console.log('url not found: ', feature.get('moreurl'));
          feature.unset('moreurl', {silent: true});
        }
        callback();
      });
    },
    function() {
      updateUrlCallback();
    });
  },
 
  render: function() {
    console.log("rendering to the file…");

    // Render the template to the output file
    var html = this.template({ featuretags: featuretags, features: this.collection.toJSON() });
    fs.writeFileSync(paths.output, html);
    console.log("Your index page is now ready")
  }
}); 
