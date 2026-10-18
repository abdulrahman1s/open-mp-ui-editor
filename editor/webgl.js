/* GTA texture-atlas text, not CSS text or substitute TTF fonts. */
(function (root) {
  'use strict';
  function subfont(id, style) {
    if (style === 1) {
      const special = {1:208,4:93,7:206,8:94,9:95,14:207,26:154};
      if (Object.hasOwn(special,id)) return special[id];
    }
    if (id === 6) return 10;
    if (id >= 16 && id <= 25) return id - 128 & 255;
    if (id === 31) return 91;
    if (id >= 33 && id <= 58) return id + 122;
    if (id === 62) return 32;
    if (id >= 65 && id <= 90) return id + 90;
    if (id >= 96 && id <= 118) return id + 85;
    if (id >= 119 && id <= 140) return id + 62;
    if (id >= 141 && id <= 142) return 204;
    if (id === 143) return 205;
    return id;
  }
  function glyph(character, font, data) {
    let id = character.codePointAt(0) - 32;
    if (id < 0 || id > 223) id = 31;
    // PC font1 contains subtitles/pricedown; font2 contains Gothic/menu.
    const atlas = font === 1 || font === 3 ? 0 : 1;
    if (font === 2 || font === 3) id = subfont(id, font === 3 ? 1 : 2);
    const widths=data.metrics[1-atlas];
    return {id, atlas, advance: widths[id] ?? widths[0], u:(id & 15)/16, v:Math.floor(id/16)/12.8};
  }
  class GameRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = this.gl = canvas.getContext('webgl', {alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
      if (!gl) throw Error('WebGL is unavailable. Enable graphics acceleration in the browser.');
      function shader(type, source) {
        const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
        return s;
      }
      const program = this.program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 pos; attribute vec2 uv; uniform vec2 canvasSize; varying vec2 tex; void main(){gl_Position=vec4(pos.x/canvasSize.x*2.0-1.0,1.0-pos.y/canvasSize.y*2.0,0.0,1.0);tex=uv;}'));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 tex; uniform sampler2D image; uniform vec4 tint; uniform float textured; void main(){vec4 c=mix(vec4(1.0),texture2D(image,tex),textured);gl_FragColor=c*tint;}'));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      for (const [name,offset] of [['pos',0],['uv',8]]) {
        const loc=gl.getAttribLocation(program,name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,16,offset);
      }
      this.tint = gl.getUniformLocation(program,'tint'); this.textured=gl.getUniformLocation(program,'textured');
      this.canvasSize=gl.getUniformLocation(program,'canvasSize');
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      this.textures=[]; this.ready=false;
    }
    async load(data) {
      if (!data?.textures || !data?.metrics) throw Error('GTA font data is missing. Run extract-fonts.py with your GTA installation path.');
      this.data=data;
      const gl=this.gl;
      this.textures=await Promise.all(['font1','font2'].map(async name => {
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error(`Cannot load ${name}.`));image.src=data.textures[name];});
        const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        // Fitted previews often minify the original glyphs. A single bilinear
        // sample aliases their strokes; trilinear sampling retains smooth edges.
        if((image.width & image.width-1)===0&&(image.height & image.height-1)===0){
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        }
        return texture;
      }));
      this.sprites={};
      this.loadingSprites=new Set();
      this.ready=true;
    }
    loadSprite(name){
      const asset=root.GAME_SPRITES?.[name];if(!asset||this.loadingSprites.has(name))return;
      this.loadingSprites.add(name);const image=new Image();
      image.onload=()=>{
        const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
        for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);this.sprites[name]=texture;
        if(this.lastDraw)this.draw(...this.lastDraw);
      };
      image.src=asset.image;
    }
    quad(x,y,w,h,color,texture=null,u=0,v=0,uw=1,vh=1) {
      const gl=this.gl;
      if (w<=0 || h<=0) return;
      gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([x,y,u,v,x+w,y,u+uw,v,x,y+h,u,v+vh,x,y+h,u,v+vh,x+w,y,u+uw,v,x+w,y+h,u+uw,v+vh]),gl.STREAM_DRAW);
      const c=color.replace('#',''); gl.uniform4f(this.tint,...[0,2,4,6].map(i=>parseInt(c.slice(i,i+2),16)/255));
      gl.uniform1f(this.textured,texture?1:0); if(texture) gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    text(shape) {
      let x=shape.x;
      const sy=shape.sy, sx=shape.sx, outline=shape.outline;
      for (const character of shape.text.replaceAll('_',' ')) {
        const g=glyph(character,shape.font,this.data), tex=this.textures[g.atlas];
        if(character!==' ') {
          // The client halves CFont's vertical scale: 40 atlas pixels occupy
          // 10 TextDraw units at LetterSizeY=1. Horizontal advances stay native.
          const w=32*sx,h=10*sy, uw=1/16-.0005,vh=1/12.8-.0005;
          for (const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
            if(outline) this.quad(x+dx*outline,shape.y+dy*outline,w,h,'#000000FF',tex,g.u,g.v,uw,vh);
          }
          this.quad(x,shape.y,w,h,shape.color,tex,g.u,g.v,uw,vh);
        }
        x+=(g.advance+outline)*sx;
      }
    }
    draw(plan,width=1920,height=1080,baseHeight=448,raster=null) {
      this.lastDraw=[plan,width,height,baseHeight,raster];
      const gl=this.gl;
      const pixelWidth=raster?.width??width,pixelHeight=raster?.height??height;
      if(this.canvas.width!==pixelWidth)this.canvas.width=pixelWidth;
      if(this.canvas.height!==pixelHeight)this.canvas.height=pixelHeight;
      gl.viewport(0,0,pixelWidth,pixelHeight); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);gl.uniform2f(this.canvasSize,640,baseHeight);
      if(!this.ready) return;
      for(const shape of plan.shapes) {
        if(shape.kind==='rect') this.quad(shape.x,shape.y,shape.w,shape.h,shape.color);
        else if(shape.kind==='native_box') {
          // CFont::GetTextRect uses a four-pixel border and a line height of
          // 18*CFontScaleY. The client passes LetterSizeY/2 to CFont.
          const px=4*640/width,py=4*baseHeight/height;
          this.quad(shape.x-px,shape.y-py,shape.w+px*2,9*shape.sy+py*2,shape.color);
        }
        else if(shape.kind==='text') this.text(shape);
        else if(shape.kind==='sprite') {
          if(shape.texture==='LD_SPAC:white')this.quad(shape.x,shape.y,shape.w,shape.h,shape.color);
          else if(shape.texture==='LD_SPAC:black')this.quad(shape.x,shape.y,shape.w,shape.h,'#000000'+shape.color.slice(-2));
          else if(this.sprites[shape.texture])this.quad(shape.x,shape.y,shape.w,shape.h,shape.color,this.sprites[shape.texture]);
          else this.loadSprite(shape.texture);
        }
        // No invented replacement for GTA's 3D model renderer.
      }
    }
    capture(){
      if(!this.ready||!this.lastDraw)throw Error('Load the GTA fonts before exporting a preview.');
      const previous=this.lastDraw;
      try { this.draw(...previous.slice(0,4));return this.canvas.toDataURL('image/png'); }
      finally { this.draw(...previous); }
    }
  }
  root.GameRenderer=GameRenderer;
  root.GtaGlyph=glyph;
})(globalThis);
