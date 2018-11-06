var fileName;
var data;
var dv;
var textureInfo;
var pixelIndex;
var pixelPallate;
var flagOffset;
var lastColor;

function textureHeader() {
	this.name = null;
	this.flags = null;
	this.width = null;
	this.height = null;
	this.index = null;
};

function color() {
	this.r = 0;
	this.g = 0;
	this.b = 0;
};

$(document).ready(function() {
	$("#file").on('change', handleFileSelect);
});

function errorHandler(evt) {
	switch(evt.target.error.code) {
		case evt.target.error.NOT_FOUND_ERR:
			alert('File Not Found!');
			break;
		case evt.target.error.NOT_READABLE_ERR:
			alert('File is not readable');
			break;
		case evt.target.error.ABORT_ERR:
			break;
		default:
			alert('An error occurred reading this file.');
	};
}

function handleFileSelect(evt) {
	fileName = evt.target.files[0].name + evt.target.files[0].type;
	var reader = new FileReader();
	reader.onerror = errorHandler;
	reader.onload = function(e) {
		data = reader.result;
		dv = new DataView(data, 0);
					
		if (dv.getUint32(0) != 1229214548) {
			alert("Unknown version of studio model");
			return;
		}
		
		if (dv.getUint8(4) != 10) {
			alert("Unknown version of Half-Life studio model");
			return;
		}
		
		var textureNum = dv.getUint32(180, 1);
		var textureOffset = dv.getUint32(184, 1);

		textureInfo = new Array(textureNum);
		pixelIndex = new Array(textureNum);
		pixelPallate = new Array(textureNum);
		flagOffset = new Array(textureNum);
						
		for (var i = 0; i < textureNum; i++) {
			textureInfo[i] = new textureHeader();
			//textureInfo[i].name = dv.getString(textureOffset, 64);
			textureOffset += 64;
			textureInfo[i].flags = dv.getUint32(textureOffset, 1);
			flagOffset[i] = textureOffset;
			textureOffset += 4;
			textureInfo[i].width = dv.getUint32(textureOffset, 1);
			textureOffset += 4;
			textureInfo[i].height = dv.getUint32(textureOffset, 1);
			textureOffset += 4;
			textureInfo[i].index = dv.getUint32(textureOffset, 1);
			textureOffset += 4;
		}
		
		for (var i = 0; i < textureNum; i++) {
			var pointer = textureInfo[i].index;
			pixelIndex[i] = new Array(textureInfo[i].width * textureInfo[i].height);
			for (var j = 0; j < textureInfo[i].width * textureInfo[i].height; j++) {
				pixelIndex[i][j] = dv.getUint8(pointer++);
			}
			
			pixelPallate[i] = new Array(256);
			for (var j = 0; j < 256; j++) {
				pixelPallate[i][j] = new color();
				pixelPallate[i][j].r = dv.getUint8(pointer++);
				pixelPallate[i][j].g = dv.getUint8(pointer++);
				pixelPallate[i][j].b = dv.getUint8(pointer++);
			}
			
			var canvas = document.createElement("canvas");
			canvas.id = i;
			canvas.width = textureInfo[i].width;
			canvas.height = textureInfo[i].height;
			
			var ctx = canvas.getContext("2d");
			var img = ctx.createImageData(textureInfo[i].width, textureInfo[i].height);
			
			for (var j = 0, k = 0; j < img.data.length; j += 4, k++) {
				img.data[j] = pixelPallate[i][pixelIndex[i][k]].r;
				img.data[j + 1] = pixelPallate[i][pixelIndex[i][k]].g;
				img.data[j + 2] = pixelPallate[i][pixelIndex[i][k]].b;
				img.data[j + 3] = textureInfo[i].flags & (1<<6) && pixelIndex[i][k] == 255 ? 0 : 255;
			}
			
			ctx.putImageData(img, 0, 0);
			
			$("#textures").append(canvas);
			$("#textures").append("<hr>");
			
			canvas.onclick = function(e) {
				var pos = findPos(this);
				var x = e.pageX - pos.x;
				var y = e.pageY - pos.y;
				var id = this.id;
										
				var curPixelIndex = y * textureInfo[id].width + x;
				var curColorIndex = pixelIndex[id][curPixelIndex];
				
				if (curColorIndex == 255) {
					if (textureInfo[id].flags & (1<<6))
						return;

					textureInfo[id].flags |= (1<<6);
				}
				
				var ctx = this.getContext("2d");
				var img = ctx.getImageData(0, 0, textureInfo[id].width, textureInfo[id].height);
				
				if (e.altKey)
				{
					var curPixelColor = pixelPallate[id][curColorIndex];
					
					pixelPallate[id][curColorIndex] = pixelPallate[id][255];
					pixelPallate[id][255] = curPixelColor;
					
					var pallateOffset = textureInfo[id].index + textureInfo[id].width * textureInfo[id].height;
					dv.setUint8(pallateOffset + curColorIndex * 3, pixelPallate[id][curColorIndex].r);
					dv.setUint8(pallateOffset + curColorIndex * 3 + 1, pixelPallate[id][curColorIndex].g);
					dv.setUint8(pallateOffset + curColorIndex * 3 + 2, pixelPallate[id][curColorIndex].b);
					
					dv.setUint8(pallateOffset + 255 * 3, pixelPallate[id][255].r);
					dv.setUint8(pallateOffset + 255 * 3 + 1, pixelPallate[id][255].g);
					dv.setUint8(pallateOffset + 255 * 3 + 2, pixelPallate[id][255].b);
					
					var imgSize = textureInfo[id].width * textureInfo[id].height;

					for (j = 0; j < imgSize; j++) {
						if (pixelIndex[id][j] == curColorIndex) {
							pixelIndex[id][j] = 255;
							dv.setUint8(textureInfo[id].index + j, 255);
							img.data[j * 4 + 3] = 0;
						}
						else if (pixelIndex[id][j] == 255) {
							pixelIndex[id][j] = curColorIndex;
							dv.setUint8(textureInfo[id].index + j, curColorIndex);
							img.data[j * 4] = pixelPallate[id][curColorIndex].r;
							img.data[j * 4 + 1] = pixelPallate[id][curColorIndex].g;
							img.data[j * 4 + 2] = pixelPallate[id][curColorIndex].b;
							img.data[j * 4 + 3] = 255;
						}
					}	
				} 
				else
				{
					var imgSize = textureInfo[id].width * textureInfo[id].height;

					for (j = 0; j < imgSize; j++) {
						if (pixelIndex[id][j] == curColorIndex) {
							dv.setUint8(textureInfo[id].index + j, 255);
							img.data[j * 4 + 3] = 0;
						}
					}			
				}							

				dv.setUint32(flagOffset[id], textureInfo[id].flags | (1<<6), 1);
				ctx.putImageData(img, 0, 0);
			}
			
			canvas.oncontextmenu = function(e) {
				e.preventDefault();
				var pos = findPos(this);
				var x = e.pageX - pos.x;
				var y = e.pageY - pos.y;
				var id = this.id;
										
				var curPixelIndex = y * textureInfo[id].width + x;
				var curColorIndex = pixelIndex[id][curPixelIndex];
				
				if (curColorIndex == 255)
					return;
				
				var ctx = this.getContext("2d");
				var img = ctx.getImageData(0, 0, textureInfo[id].width, textureInfo[id].height);
														
				var imgSize = textureInfo[id].width * textureInfo[id].height;

				for (j = 0; j < imgSize; j++) {
					if (pixelIndex[id][j] == curColorIndex) {
						dv.setUint8(textureInfo[id].index + j, curColorIndex);
						img.data[j * 4] = pixelPallate[id][curColorIndex].r;
						img.data[j * 4 + 1] = pixelPallate[id][curColorIndex].g;
						img.data[j * 4 + 2] = pixelPallate[id][curColorIndex].b;
						img.data[j * 4 + 3] = 255;
					}
				}
				ctx.putImageData(img, 0, 0);
			}
		}
		$("#file").remove();
		$("#menu").append("<input type=\"button\" onclick=\"save_file()\" value=\"Save\"/>");
		$("#menu").append("<div id=\"control-info\"><b>Left-click:</b> transparent | <b>Right-click:</b> untransparent | <b>Alt+left-click:</b> to swap with transparent color</div>");
	}
	reader.readAsArrayBuffer(evt.target.files[0]);
}

function save_file() {
	var saver = $('#saver');
	var blob = new Blob([data], {type: "octet/stream"});
	var url = window.URL.createObjectURL(blob);
	saver.attr('href', url);
	saver.attr('download', fileName);
	jQuery('#saver')[0].click();
	window.URL.revokeObjectURL(url);
}

function findPos(obj) {
	var curleft = 0, curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
		return { x: curleft, y: curtop };
	}
	return undefined;
}