brainsprite.modules = {};

brainsprite.modules.colorMap = function(brain, params) {
  this.brain = brain;
  this.params = Object.assign({}, {
    color: '#FFFFFF',
    width: 3,
    radius: 5,
  }, params);

  this.brain._imgload(this.params.colors, function(img){
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.canvas.width  = img.width;
    this.canvas.height = img.height;
    this.context.drawImage(
      img,
      0, 0, img.width, img.height,
      0, 0, img.width, img.height
    );

    this.ready = true;
    this.brain.init();
  }.bind(this));

  this.inject = function () {
    var i = NaN;
    var value = Infinity;

    var anchor = this.brain.getAnchor();
    var layer = this.brain.getLayer(this.params.layer);
    var context = layer.planes.X.context;

    var pos = {};
    pos.XW = brain.slice.X % anchor.nbCol;
    pos.XH = (brain.slice.X - pos.XW) / anchor.nbCol;

    var rgb = context.getImageData(
      pos.XW * anchor.slices.Y + brain.slice.Y,
      pos.XH * anchor.slices.Z + brain.slice.Z,
      1, 1
    ).data;

    if (rgb[3] == 0) {
      return { value: undefined };
    }

    var colors = this.canvas.width;
    for (var x = 0; x < colors; x++) {
      var cv = this.context.getImageData(x, 0, 1, 1).data;
      var dist = Math.pow(cv[0] - rgb[0], 2) +
                 Math.pow(cv[1] - rgb[1], 2) +
                 Math.pow(cv[2] - rgb[2], 2);
      if (dist < value) {
        i = x;
        value = dist;
      }
    }

    return {
      value: (
        i * (this.params.max - this.params.min) / (colors - 1)
      ) + this.params.min,
    };
  }
}

brainsprite.modules.cross = function(brain, params) {
  this.brain = brain;
  this.params = Object.assign({}, {
    color: '#FFFFFF',
    width: 3,
    radius: 5,
  }, params);

  this.ready = true;
  this.brain.init();

  this.drawCrossAt = function(context, center) {
    brain.context.strokeStyle = this.params.color;
    context.lineWidth = this.params.width;

    context.beginPath();

    context.moveTo(center.x, center.y - this.params.radius);
    context.lineTo(center.x, center.y + this.params.radius);
    context.stroke();

    context.moveTo(center.x - this.params.radius, center.y);
    context.lineTo(center.x + this.params.radius, center.y);
    context.stroke();
  }

  this.dirty = function () {
    return { X: true, Y: true, Z: true };
  }

  this.draw = function (dirty) {
    dirty.X && this.drawCrossAt(this.brain.context, this.brain.center.X())
    dirty.Y && this.drawCrossAt(this.brain.context, this.brain.center.Y())
    dirty.Z && this.drawCrossAt(this.brain.context, this.brain.center.Z())
  }
}