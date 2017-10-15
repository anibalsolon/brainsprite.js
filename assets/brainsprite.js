function brainsprite(params) {

  // Initialize the brain object
  var defaultParams = {

    initial: {},

    // Flag for "NaN" image values, i.e. unable to read values
    nanValue: false,

    // Smoothing of the main slices
    smooth: false,

    // drawing mode
    fastDraw: false,

    // interactive mode
    interactive: true,

    // Background color for the canvas
    background: '#000000',

    // Flag to turn on/off slice numbers
    flagCoordinates: false,

    // Layers
    layers: [],

    // Anchor layer
    anchor: 0,
  }

  var brain = Object.assign({}, defaultParams, params);

  brain._imgload = function(img, callback) {
    if (typeof img == "string") {
      var node = document.getElementById(img);
      if (!node) {
        node = new Image();
        node.addEventListener('load', function() {
          callback(node);
        }, false);
        node.src = img;
      }
    } else if (img.tagName && img.tagName.toUpperCase() == "IMG") {
      if (!img.complete) {
        img.addEventListener('load', function() {
          callback(img);
        }, false);
      } else {
        callback(img);
      }
    }
  }

  brain.init = function() {

    // Wait to load every image
    for (var i in brain.layers) {
      var l = brain.layers[i];
      if (!l.ready) {
        return;
      }
    }

    // Wait to init every module
    for (var m in brain.modules) {
      var ins = brain.modules[m].instance;
      if (!ins.ready) {
        return;
      }
    }

    var anchor = brain.getAnchor();

    // Number of columns and rows in the sprite
    anchor.nbCol = anchor.image.width / anchor.slices.Y;
    anchor.nbRow = anchor.image.height / anchor.slices.Z;

    // Number of slices
    anchor.slices.X = anchor.nbCol * anchor.nbRow;

    // Width and height for the canvas
    brain.width = { X: 0, Y: 0, Z: 0, total: 0, offset: 0 };
    brain.height = { X: 0, Y: 0, Z: 0, center: 0, offset: 0 };

    // Default for current slices
    brain.slice = {
      X: brain.initial.X || Math.floor(anchor.slices.X / 2),
      Y: brain.initial.Y || Math.floor(anchor.slices.Y / 2),
      Z: brain.initial.Z || Math.floor(anchor.slices.Z / 2)
    };

    brain.dirty = { X: true, Y: true, Z: true };

    if (brain.interactive) {
      brain.canvas.addEventListener('click', brain._canvasClick, false);
      brain.canvas.addEventListener('mousedown', function(e) {
        brain.canvas.addEventListener('mousemove', brain._canvasClick, false);
      }, false);
      brain.canvas.addEventListener('mouseup', function(e) {
        brain.canvas.removeEventListener('mousemove', brain._canvasClick, false);
      }, false);
    }

    brain.mapping = {};

    // Initialize fast draw for each layer axis
    for (var i in brain.layers) {
      var layer = brain.layers[i];

      if (layer.name) {
        brain.mapping[layer.name] = i;
      }

      if (layer.module) {
        continue;
      }

      layer.planes = {};

      layer.planes.X = {};
      layer.planes.X.canvas = document.createElement('canvas');
      layer.planes.X.canvas.width = layer.image.width;
      layer.planes.X.canvas.height = layer.image.height;
      layer.planes.X.context = layer.planes.X.canvas.getContext('2d');
      layer.planes.X.context.globalAlpha = layer.opacity;
      layer.planes.X.context.drawImage(
        layer.image,
        0, 0, layer.image.width, layer.image.height,
        0, 0, layer.image.width, layer.image.height
      );

      layer.planes.Y = {};
      layer.planes.Y.canvas = document.createElement('canvas');
      layer.planes.Y.canvas.width = anchor.slices.X * anchor.nbCol;
      layer.planes.Y.canvas.height = anchor.slices.Z * Math.ceil(anchor.slices.Y / anchor.nbCol);
      layer.planes.Y.context = layer.planes.Y.canvas.getContext('2d');
      layer.planes.Y.context.globalAlpha = layer.opacity;

      var pos = {};
      for (var yy = 0; yy < anchor.slices.Y; yy++) {
        for (var xx = 0; xx < anchor.slices.X; xx++) {
          pos.XW = xx % anchor.nbCol;
          pos.XH = (xx - pos.XW) / anchor.nbCol;
          pos.YW = (yy % anchor.nbCol);
          pos.YH = (yy - pos.YW) / anchor.nbCol;
          layer.planes.Y.context.drawImage(
            layer.image,
            pos.XW * anchor.slices.Y + yy, pos.XH * anchor.slices.Z, 1, anchor.slices.Z,
            pos.YW * anchor.slices.X + xx, pos.YH * anchor.slices.Z, 1, anchor.slices.Z
          );
        }
      }

      layer.planes.Z = {};
      layer.planes.Z.canvas = document.createElement('canvas');
      layer.planes.Z.canvas.width = Math.max(
        anchor.slices.X * anchor.nbCol,
        anchor.slices.Y * Math.ceil(anchor.slices.Z / anchor.nbCol)
      );
      layer.planes.Z.canvas.height = layer.planes.Z.canvas.width;
      layer.planes.Z.context = layer.planes.Z.canvas.getContext('2d');
      layer.planes.Z.context.globalAlpha = layer.opacity;
      layer.planes.Z.context.rotate(-Math.PI / 2);
      layer.planes.Z.context.translate(-layer.planes.Z.canvas.width, 0);

      var pos = {};
      for (var zz = 0; zz < anchor.slices.Z; zz++) {
        for (var xx = 0; xx < anchor.slices.X; xx++) {
          pos.XW = xx % anchor.nbCol;
          pos.XH = (xx - pos.XW) / anchor.nbCol;
          pos.ZH = zz % anchor.nbCol;
          pos.ZW = Math.ceil(anchor.slices.Z / anchor.nbCol) - 1 - ((zz - pos.ZH) / anchor.nbCol);

          layer.planes.Z.context.drawImage(
            layer.image,
            pos.XW * anchor.slices.Y, pos.XH * anchor.slices.Z + zz, anchor.slices.Y, 1,
            pos.ZW * anchor.slices.Y , pos.ZH * anchor.slices.X + xx , anchor.slices.Y , 1
          );
        }
      }
    }

    brain.resize();
    brain.moveTo(brain.slice);

    brain.triggerEvent('init', {});
  };

  brain.getAnchor = function() {
    return brain.layers[brain.anchor];
  };

  brain.resize = function() {
    var slices = brain.getAnchor().slices;

    brain.canvas.width = brain.canvas.offsetWidth;
    brain.canvas.height = brain.canvas.offsetHeight;

    // Update the width of the X, Y and Z slices in the canvas, based on the width of its parent
    var width = brain.width = {
      X: Math.floor(brain.canvas.offsetWidth * (slices.Y / (2 * slices.X + slices.Y))),
      Y: Math.floor(brain.canvas.offsetWidth * (slices.X / (2 * slices.X + slices.Y))),
      Z: Math.floor(brain.canvas.offsetWidth * (slices.X / (2 * slices.X + slices.Y))),
      offset: 0,
    }
    width.total = width.X + width.Y + width.Z;

    // Update the height of the slices in the canvas, based on width and image ratio
    var height = brain.height = {
      X: Math.floor(width.X * slices.Z / slices.Y),
      Y: Math.floor(width.Y * slices.Z / slices.X),
      Z: Math.floor(width.Z * slices.Y / slices.X),
      offset: 0,
    }

    height.center = brain.canvas.offsetHeight / 2;
    height.total = height.X + height.Y + height.Z;
    height.max = Math.max(height.X, height.Y, height.Z);

    // Resize axis if height does not match with canvas
    if (brain.canvas.offsetHeight < height.max) {
      var ratio = brain.canvas.offsetHeight / height.max;
      width.X = Math.floor(width.X * ratio);
      width.Y = Math.floor(width.Y * ratio);
      width.Z = Math.floor(width.Z * ratio);
      width.total = width.X + width.Y + width.Z;
      height.X = Math.floor(height.X * ratio);
      height.Y = Math.floor(height.Y * ratio);
      height.Z = Math.floor(height.Z * ratio);
      width.offset = Math.floor(brain.canvas.offsetWidth / 2 - width.total / 2);
      height.offset = 0;
    }

    brain.dirty = { X: true, Y: true, Z: true };
    brain.drawAll();
  };

  var _into = function(p) {
    return (
      p.x >= this.x && p.x < this.x + this.width &&
      p.y >= this.y && p.y < this.y + this.height
    );
  };

  brain.bbox = {
    X: function(){
      return {
        x: brain.width.offset + 0,
        y: Math.floor(brain.height.center - brain.height.X / 2),
        width: brain.width.X,
        height: brain.height.X,
        into: _into,
        slice: function(p) {
          var slices = brain.getAnchor().slices;
          return {
            Y: Math.round(slices.Y * (p.x - this.x) / this.width),
            Z: Math.round(slices.Z * (p.y - this.y) / this.height),
          }
        },
        pixel: function(s) {
          var slices = brain.getAnchor().slices;
          return {
            x: this.x + Math.round(s.Y * this.width / slices.Y),
            y: this.y + Math.round(s.Z * this.height / slices.Z),
          }
        },
      }
    },
    Y: function(){
      return {
        x: brain.width.offset + brain.width.X,
        y: Math.floor(brain.height.center - brain.height.Y / 2),
        width: brain.width.Y,
        height: brain.height.Y,
        into: _into,
        slice: function(p) {
          var slices = brain.getAnchor().slices;
          return {
            X: Math.round(slices.X * (p.x - this.x) / this.width),
            Z: Math.round(slices.Z * (p.y - this.y) / this.height),
          }
        },
        pixel: function(s) {
          var slices = brain.getAnchor().slices;
          return {
            x: this.x + Math.round(s.X * this.width / slices.X),
            y: this.y + Math.round(s.Z * this.height / slices.Z),
          }
        },
      }
    },
    Z: function(){
      return {
        x: brain.width.offset + brain.width.X + brain.width.Y,
        y: Math.floor(brain.height.center - brain.height.Z / 2),
        width: brain.width.Z,
        height: brain.height.Z,
        into: _into,
        slice: function(p) {
          var slices = brain.getAnchor().slices;
          return {
            X: Math.round(slices.X * (p.x - this.x) / this.width),
            Y: Math.round(slices.Y * (1 - (p.y - this.y) / this.height)),
          }
        },
        pixel: function(s) {
          var slices = brain.getAnchor().slices;
          return {
            x: this.x + Math.round(s.X * this.width / slices.X),
            y: this.y - Math.round((s.Y - slices.Y) * this.height / slices.Y),
          }
        },
      }
    },
  };

  brain.getLayer = function(nameOrIndex) {
    if (typeof nameOrIndex == "number" && nameOrIndex < brain.layers.length) {
      return brain.layers[nameOrIndex];
    } else if (nameOrIndex in brain.mapping) {
      return brain.layers[brain.mapping[nameOrIndex]];
    } else {
      throw Error("Invalid layer index");
    }
  };

  brain.draw = function() {
    if (!brain.dirty.X && !brain.dirty.Y && !brain.dirty.Z)
      return;

    var anchor = brain.getAnchor();
    var pos = {};
    pos.XW = brain.slice.X % anchor.nbCol;
    pos.XH = (brain.slice.X - pos.XW) / anchor.nbCol;
    pos.YW = brain.slice.Y % anchor.nbCol;
    pos.YH = (brain.slice.Y - pos.YW) / anchor.nbCol;
    pos.ZW = brain.slice.Z % anchor.nbCol;
    pos.ZH = (brain.slice.Z - pos.ZW) / anchor.nbCol;

    var bbox = {
      X: brain.bbox.X(),
      Y: brain.bbox.Y(),
      Z: brain.bbox.Z(),
    };

    brain.context.fillStyle = brain.background;
    if (brain.dirty.X && brain.dirty.Y && brain.dirty.Z)
      brain.context.fillRect(0, 0, brain.canvas.width, brain.canvas.height);
    else {
      // Set fill color for the axis
      brain.dirty.X && brain.context.fillRect(bbox.X.x, bbox.X.y, bbox.X.width, bbox.X.height);
      brain.dirty.Y && brain.context.fillRect(bbox.Y.x, bbox.Y.y, bbox.Y.width, bbox.Y.height);
      brain.dirty.Z && brain.context.fillRect(bbox.Z.x, bbox.Z.y, bbox.Z.width, bbox.Z.height);
    }

    for (var i in brain.layers) {
      var layer = brain.layers[i];

      if (layer.module && brain.modules[layer.module]) {
        var mod = brain.modules[m].instance;
        mod.draw && mod.draw(Object.assign({}, brain.dirty));
        continue;
      }

      if (brain.dirty.X) {
        brain.context.drawImage(
          layer.planes.X.canvas,
          pos.XW * anchor.slices.Y,
          pos.XH * anchor.slices.Z,
          anchor.slices.Y,
          anchor.slices.Z,
          bbox.X.x,
          bbox.X.y,
          bbox.X.width,
          bbox.X.height
        );
      }

      if (brain.dirty.Y) {
        brain.context.drawImage(
          layer.planes.Y.canvas,
          pos.YW * anchor.slices.X,
          pos.YH * anchor.slices.Z,
          anchor.slices.X,
          anchor.slices.Z,
          bbox.Y.x,
          bbox.Y.y,
          bbox.Y.width,
          bbox.Y.height
        );
      }

      if (brain.dirty.Z) {
        brain.context.drawImage(
          layer.planes.Z.canvas,
          pos.ZW * anchor.slices.X,
          pos.ZH * anchor.slices.Y,
          anchor.slices.X,
          anchor.slices.Y,
          bbox.Z.x,
          bbox.Z.y,
          bbox.Z.width,
          bbox.Z.height
        );
      }
    }

    brain.dirty.X = brain.dirty.Y = brain.dirty.Z = false;
  };

  brain.moveTo = function(coords) {
    var slices = brain.getAnchor().slices;

    coords.X = Math.max(Math.min(coords.X || brain.slice.X, slices.X - 1), 0);
    coords.Y = Math.max(Math.min(coords.Y || brain.slice.Y, slices.Y - 1), 0);
    coords.Z = Math.max(Math.min(coords.Z || brain.slice.Z, slices.Z - 1), 0);

    // Set dirty if change coord
    brain.dirty = {
      X: brain.dirty.X || coords.X != brain.slice.X,
      Y: brain.dirty.Y || coords.Y != brain.slice.Y,
      Z: brain.dirty.Z || coords.Z != brain.slice.Z,
    };

    // Check for dirtiness on modules
    for (var m in brain.modules) {
      var ins = brain.modules[m].instance;
      if (ins.dirty) {
        var d = ins.dirty(brain.dirty);
        brain.dirty = {
          X: brain.dirty.X || d.X,
          Y: brain.dirty.Y || d.Y,
          Z: brain.dirty.Z || d.Z,
        };
      }
    }

    brain.slice = coords;

    brain.triggerEvent('change', Object.assign({}, coords));
    brain.draw();
  };

  brain.eventListeners = { init: [], change: [] };
  brain.addEventListener = function(type, listener) {
    if (['init', 'change'].indexOf(type) < 0) return;
    brain.eventListeners[type].push({ listener: listener });
  };

  brain.removeEventListener = function(type, listener) {
    var i = 0;
    while (i < brain.eventListeners[type].length) {
      var eventListener = brain.eventListeners[type][i];
      if (eventListener.listener == listener) {
        brain.eventListeners[type].splice(i, 1);
        break;
      }
      ++i;
    }
  };

  brain.triggerEvent = function(type, payload) {
    payload = Object.assign({}, payload);

    for (var m in brain.modules) {
      var ins = brain.modules[m].instance;
      if (ins.inject)
        payload[m] = ins.inject(type, Object.assign({}, payload));
    }

    // Strip out functions & clone
    payload = JSON.parse(JSON.stringify(payload));

    var i = 0;
    while (i < brain.eventListeners[type].length) {
      var eventListener = brain.eventListeners[type][i++];
      eventListener.listener.call(brain, payload);
    }
  };

  brain._canvasClick = function(e) {
    var rect = brain.canvas.getBoundingClientRect();
    var xx = e.clientX - rect.left;
    var yy = e.clientY - rect.top;
    var p = { x: xx, y: yy };
    var sx, sy, sz;

    var slices = brain.getAnchor().slices;

    var bbox = brain.bbox.X();
    if (bbox.into(p)) {
      brain.moveTo(bbox.slice({ x: xx, y: yy }, slices));
      return;
    }

    var bbox = brain.bbox.Y();
    if (bbox.into(p)) {
      brain.moveTo(bbox.slice({ x: xx, y: yy }, slices));
      return;
    }

    var bbox = brain.bbox.Z();
    if (bbox.into(p)) {
      brain.moveTo(bbox.slice({ x: xx, y: yy }, slices));
      return;
    }
  };

  brain.drawAll = function() {
    brain.dirty = { X: true, Y: true, Z: true };
    brain.draw();
  };

  if (params.initial) {
    brain.initial = params.initial;
  }

  brain.modules = [];

  // The main canvas, where the three slices are drawn
  brain.canvas = brain.canvas || document.createElement('canvas');
  brain.context = brain.canvas.getContext('2d');
  if (brain.smooth)
    brain.context.imageSmoothingEnabled = true;

  for (var i in params.layers) {
    brain.layers[i] = params.layers[i];
    if (brain.layers[i].anchor) {
      brain.anchor = i;
    }
    (function(index) {
      if (brain.layers[index].sprite) {
        brain._imgload(brain.layers[index].sprite, function(img){
          brain.layers[index].image = img;
          brain.layers[index].ready = true;
          brain.init();
        });
      } else {
        brain.layers[index].ready = true;
        brain.init();
      }
    })(i);
  }

  for (var m in params.modules) {
    brain.modules[m] = params.modules[m];
    brain.modules[m].instance =
      new brain.modules[m].module(
        brain,
        brain.modules[m].params
      );
  }

  return brain;
};