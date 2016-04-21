/**
 * Load the saved image data and display for user to save
 * @author Patrick Oladimeji
 * @date 4/23/14 20:21:03 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, Promise */
require(["lib/d3.min", "Storage.min"], function (d3, db) {
	"use strict";
	var currentPhoto = "",
		tileHeight,
		tileWidth,
		width,
		height,
		imageWidth = 600,
		bottomToolbarHeight = 40;

	/**
		Uses native alert to notify and falls back on html alert.
	*/
	function _alert(msg, title) {
		if (navigator.notification) {
			navigator.notification.alert(msg, null, title);
		} else {
			alert(msg);
		}
	}

	/**
        Figures out the width and height of the screen and updates the tile sizes
    */
	function fixTileWidthAndHeight() {
		var pixelCorrection = 1;
		var scale = 1,
			cWidth = document.documentElement.clientWidth,
			cHeight = document.documentElement.clientHeight,
			sWidth = window.screen.width,
			sHeight = window.screen.height;
		width = cWidth;
		height = cHeight - bottomToolbarHeight;
		// initialise tile height and width
		tileWidth = width / 3;
		tileHeight = height / 3;
		d3.select("body").style("width", width + "px")
			.style("height", height + "px")
			.style("margin", "0")
			.style("padding", "0");
	}

	function printImage(base64) {
		var bingo = d3.select("img#bingo");
		if (bingo.empty()) {
			bingo = d3.select("body").append("img").attr("id", "bingo");
		}

		bingo.attr("src", base64);
		bingo.attr("class", "allow-download");

		var people = d3.range(1, 10).map(function (d) {
			return db.get("box" + d + "name");
		}).filter(function (d) {
			return d;
		});

		var msg = "Just about to start my %23chi2016 %23bingo!"
		if (people.length > 0) {
			var names = people.reduce(function (previous, current, index, array) {
				var sep = ", ";
				if (index === array.length - 1) {
					sep = " and ";
				}
				return previous ? previous.concat(sep).concat(current) : current;
			});
			var verb = people.length > 1 ? " are " : " is ";
			msg = names + verb + "in my %23chi2016 %23bingo";
		}
		msg = "https://twitter.com/intent/tweet?text=" + msg.replace(" ", "%20");

		var message = d3.select("a#message");
		message.attr("href", msg);
	}

	function renderImageAndShare(tiles) {
		var canvas = document.createElement("canvas");
		var context = canvas.getContext("2d");

		var images = [];

		function render(tiles) {
			// calculate grid dimension to get the right size for rendering final canvas
			// if there is no image on tile use zero tile dimensions
			var dimensions = tiles.map(function (tile, index, tiles) {
				return tile.image ? {
					width: tileWidth,
					height: tile.image.height * tileWidth / tile.image.width
				} : {
					width: 0,
					height: 0
				};
			});
			//fold the dimensions into rows of three
			var rows = dimensions.reduce(function (p, c, i, arr) {
				var r = p[p.length - 1];
				if (r.length < 3) {
					r.push(c);
				} else {
					p.push([c]);
				}
				return p;
			}, [
				[]
			]);
			console.log(JSON.stringify(rows));
			var rowHeights = rows.map(function (d) {
				return d3.max(d.map(function (e) {
					return e.height;
				})) || tileHeight;
			});

			var maxW = tileWidth; // (since we are fitting the image to the width of the tile)
			// set the size of the canvas based on the tile size
			canvas.width = maxW * 3;
			canvas.height = rowHeights[0] + rowHeights[1] + rowHeights[2];
			context.fillStyle = "white";
			context.fillRect(0, 0, canvas.width, canvas.height);

			tiles.forEach(function (tile, index) {
				var colIndex = index % 3,
					rowIndex = Math.floor(index / 3),
					x = colIndex * maxW,
					y = rowHeights.slice(0, rowIndex).reduce(function (a, b) {
						return a + b;
					}, 0);
				if (tile.image) {
					context.drawImage(tile.image, x, y, maxW, dimensions[index].height);
				} else {
					// just render a white background with the name?
					context.save();
					context.textAlign = "center";
					context.fillStyle = "white";
					context.fillRect(x, y, dimensions[index].width, dimensions[index].height);
					context.fillStyle = "black";
					context.fillText(tile.name || "?", x + maxW / 2, y + rowHeights[rowIndex] / 2, maxW);
					context.restore();
				}
				if (index === 8) {
					printImage(canvas.toDataURL());
				}
			});
		}

		function loadImage(tile) {
			return new Promise(function (resolve, reject) {
				var img = new Image();
				if (tile.image) {
					img.onload = function () {
						resolve({
							name: tile.name,
							image: img
						});
					};
					img.onerror = function (event) {
						reject(event);
					};
					img.src = tile.image;
				} else {
					resolve({
						name: tile.name
					});
				}
			});
		}
		Promise.all(tiles.map(function (tile) {
			return loadImage(tile);
		})).then(function (tiles) {
			render(tiles);
		}, function (err) {
			_alert(JSON.stringify(err), "Error");
		});
	}

	/**
        Returns a list of all nine tiles on the board
        returns [{name:string, image:string}]
    */
	function getAllTiles() {
		// get the tiles saved in the store and filter any non truthy values (ie those that are undefined or null)
		var tiles = d3.range(1, 10).map(function (d) {
			var imageKey = "box" + d + "image",
				nameKey = "box" + d + "name";
			return {
				name: db.get(nameKey),
				image: db.get(imageKey)
			};
		});

		return tiles;
	}

	fixTileWidthAndHeight();
	//render image to page
	renderImageAndShare(getAllTiles());
});