/**
 *
 * @author Patrick Oladimeji
 * @date 3/19/14 14:49:12 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, white:true, eqeq: true, unparam: false */
/*global define, d3, require, $, brackets, window, Promise, alert, FastClick, EXIF, MegaPixImage */
define(function(requires, exports, module) {
	"use strict";
	var d3 = require("lib/d3.min"),
		db = require("Storage.min"),
		currentPhoto = "",
		tileHeight,
		tileWidth,
		imageWidth = 600,
		bottomToolbarHeight = 40,
		width,
		height,
		imageHeight = 250,
		imageQuality = 80,
		aboutText = "CHI Demo Bingo is a fun app that aims to increase social activity at CHI.\n\nYou have just received nine demo numbers. Your mission, should you choose to accept it, is to find these nine demos and take \'selfie\' photos with each of them at the conference reception on Monday night (making sure the demo number appears in your picture).\n\nOnce your grid is completed, come and show us at the demo prize booth. The first 50 people to complete their bingo card will get a special CHI prize!\n\n\nCHI Bingo was inspired by the late Gary Marsden — a CHI veteran and dear friend.",
		demos = Array("D100", "D101", "D102", "D103", "D104", "D105", "D106", "D107", "D108", "D109", "D110", "D111", "D112",
			"D113", "D114", "D115", "D116", "D117", "D200", "D201", "D202", "D203", "D204", "D205", "D206", "D207",
			"D208", "D209", "D210", "D211", "D300", "D301", "D302", "D303", "D304", "D305", "D306", "D307", "D308",
			"D309", "D310", "D311", "D312", "D313", "D314", "D315", "D316", "D317", "D318", "D319", "D320", "D321",
			"D322", "D323", "D324", "D400", "D401", "D402", "D403", "D404", "D405", "D406", "D407", "D408", "D409",
			"D410", "D411", "D412", "D413", "D414", "D415", "D500", "D501", "D502", "D503", "D504", "D505"),
		selectedDemos = Array("Demo"),
		rowsMap = {
			"1": "123",
			"2": "123",
			"3": "123",
			"4": "456",
			"5": "456",
			"6": "456",
			"7": "789",
			"8": "789",
			"9": "789"
		},
		colsMap = {
			"1": "147",
			"2": "258",
			"3": "369",
			"4": "147",
			"5": "258",
			"6": "369",
			"7": "147",
			"8": "258",
			"9": "369"
		};

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

	function onFail(message) {
		//alert('Failed because: ' + message);
		console.log(message);
	}

	/**
		Pops up an input dialog and returns the result to promptCallback.
	*/
	function _prompt(msg, promptCallback, title, defaultText) {
		title = title || ""; // if title is false make it an empty string
		if (navigator.notification) {
			navigator.notification.prompt(msg, function(result) {
				if (result.buttonIndex === 1) { // ok was clicked
					promptCallback(result.input1);
				} else {
					promptCallback(null);
				}
			}, title, ["Ok", "Cancel"], defaultText);
		} else {
			var result = prompt(msg, defaultText, title);
			promptCallback(result);
		}
	}

	/**
		Pops up an input dialog to confirm a message.
	*/
	function _confirm(msg, promptCallback, title, okButton, cancelButton) {
		title = title || ""; // if title is false make it an empty string
		if (navigator.notification) {
			navigator.notification.confirm(msg, function(buttonIndex) {
				promptCallback(buttonIndex === 1); // index of 1 is ok; anything else is cancel
			}, title, [okButton, cancelButton]);
		} else {
			var result = confirm(msg);
			promptCallback(result);
		}
	}

	function share(imageData) {
		function success(msg) {
			//console.log(msg ? "Successfully shared image" : "Some problem sharing...");
		}

		function error(err) {
			_alert(err, "Oops – sharing encountered an error. Please try again...");
		}

		var a = document.createElement("a");
		a.setAttribute("href", "bingo.html");
		a.click();
	}
	/**
        Returns a list of all nine tiles on the board
        returns [{name:string, image:string}]
    */
	function getAllTiles() {
		// get the tiles saved in the store and filter any non truthy values (ie those that are undefined or null)
		var tiles = d3.range(1, 10).map(function(d) {
			var imageKey = "box" + d + "image",
				nameKey = "box" + d + "name";
			return {
				name: db.get(nameKey),
				image: db.get(imageKey)
			};
		});

		return tiles;
	}

	/**
        Returns a list of objects containing the tiles that have pictures in them
        returns [{name:string, image:string}]
    */
	function getCompletedTiles() {
		return getAllTiles().filter(function(d) {
			return d.image;
		});
	}

	function updateImage(tileId, imageData) {
		var img = new Image();
		img.onload = function() {
			// we can reposition the image if needed to properly centralise the captured image
			// using background-position-x or -y
			var xpos = (tileWidth - img.width) / 2,
				ypos = (tileHeight - img.height) / 2;
			var h = img.height * (tileWidth / img.width);
			d3.select("#" + tileId).style("background-image", "url(" + imageData + ")")
				.style("background-size", tileWidth + "px " + h + "px");
		};

		img.src = imageData;
	}

	function addClassToTiles(selector, clazz) {
		var animationDuration = 350;

		function add(el) {
			return new Promise(function(resolve, reject) {
				el.classed(clazz, true);
				setTimeout(function() {
					resolve(true);
				}, animationDuration);
			});
		}
		var p;
		d3.selectAll(selector).each(function() {
			var el = d3.select(this);
			if (!p) {
				p = add(el);
			} else {
				p = p.then(function() {
					return add(el);
				});
			}
		});
		return p;
	}

	function showImageAlert(src, cb) {
		// using tileWidth because we are scaling the bingo image to the screen width and the image is a square
		var top = (document.documentElement.clientHeight - tileWidth * 3) / 2;
		var alertContainer = d3.select("#alertContainer");
		alertContainer.style("display", "block").style("top", "-" + (tileWidth * 3) + "px").on("click", null);
		var img = d3.select("#alertContainer img").attr("src", src).style("width", (tileWidth * 3) + "px");
		//img.classed("rotate-text", true);
		// console.log("top is " + top);
		//default behaviour is that image is removed when user clicks on it.
		alertContainer.on("click", function() {
			alertContainer.transition().duration(500).style("top", "-1300px")
				.each("end", function() {
					alertContainer.style("display", "none");
					if (d3.select(".tile").classed("flip")) {
						var p = addClassToTiles(".tile", "unflip");
						p.then(function() {
							d3.selectAll(".tile").classed("flip", false);
						});
					}
				});
		});
		//show the image and invoke the callback after end of transition
		alertContainer.transition().duration(2000).style("top", top + "px").ease("bounce")
			.each("end", function() {
				if (typeof cb === "function") {
					cb();
				}
			});
	}

	function celebrate() {
		//console.log("done - bingo!");
		d3.selectAll(".tile").classed("unflip", false);
		var p = addClassToTiles(".tile", "flip");
		p.then(function() {
			showImageAlert("img/bingo.png");
		});
	}

	// checks if a row has been completed
	function rowCompleted(gridNumber) {
		var n = +gridNumber.substr(3);

		var incomplete = rowsMap[n].split("").some(function(d) {
			return !db.get("box" + d + "image");
		});
		return !incomplete;
	}
	
	// checks if a column has been completed
	function columnCompleted(gridNumber) {
		var n = +gridNumber.substr(3);

		var incomplete = colsMap[n].split("").some(function(d) {
			return !db.get("box" + d + "image");
		});
		return !incomplete;
	}

	// checks if a corner has been completed
	function cornerCompleted(gridNumber) {
		var n = +gridNumber.substr(3),
			corners = [1, 3, 7, 9];
		var res = corners.indexOf(n) >= 0 && corners.every(function(d) {
			return db.get("box" + d + "image");
		});
		return res;
	}

	function highlightRow(row) {
		var y = tileHeight * row,
			x = 0,
			w = width,
			h = tileHeight;
		d3.select("#rowHighlighter").style("top", y + "px").style("left", x + "px").style("width", w + "px").style("height", h + "px")
			.style("display", "block");
	}

	function highlightColumn(col) {
		var x = tileWidth * col,
			y = 0,
			w = tileWidth,
			h = height;
		d3.select("#columnHighlighter").style("top", y + "px").style("left", x + "px").style("width", w + "px").style("height", h + "px")
			.style("display", "block");
	}

	// called when a photo is successfully retrieved
	function onPhotoDataSuccess(imageData, gridNumber, orientation) {
		var n = +gridNumber.substr(3),
			tiles, sel;
		updateImage(gridNumber, imageData);
		db.set(gridNumber + "image", imageData);

		function hideAlert() {
			setTimeout(function() {
				d3.selectAll("#alertContainer").style("display", "none");
			}, 750);
		}
		//check if bingo is complete, if so celebrate
		if (getCompletedTiles().length === 9) {
			celebrate();
		} else if (cornerCompleted(gridNumber)) {
			tiles = ["#box1", "#box3", "#box7", "#box9"];
			sel = tiles.join(",");
			d3.selectAll(sel).classed("unflip", false);
			addClassToTiles(sel, "flip")
				.then(function() {
					addClassToTiles(tiles.reverse().join(","), "unflip")
						.then(function() {
							d3.selectAll(sel).classed("flip", false);
						});
					showImageAlert("img/corners.png", hideAlert);
				});
		} else if (rowCompleted(gridNumber)) {
			tiles = rowsMap[n].split("").map(function(d) {
				return "#box" + d;
			});
			sel = tiles.join(",");
			d3.selectAll(sel).classed("unflip", false);
			addClassToTiles(sel, "flip")
				.then(function() {
					addClassToTiles(tiles.reverse().join(","), "unflip")
						.then(function() {
							d3.selectAll(sel).classed("flip", false);
						});
					showImageAlert("img/line.png", hideAlert);
				});
		} else if (columnCompleted(gridNumber)) {
			tiles = colsMap[n].split("").map(function(d) {
				return "#box" + d;
			});
			sel = tiles.join(",");
			d3.selectAll(sel).classed("unflip", false);
			addClassToTiles(sel, "flip")
				.then(function() {
					addClassToTiles(tiles.reverse().join(","), "unflip")
						.then(function() {
							d3.selectAll(sel).classed("flip", false);
						});
					showImageAlert("img/line.png", hideAlert);
				});
		}
	}

	function gotPicture(event) {
		if (event.target.files.length == 1 && event.target.files[0].type.indexOf("image/") === 0) {
			var file = event.target.files[0];
			EXIF.getData(file, function() {
				var orientation = EXIF.getTag(this, "Orientation");
				var mpxImage = new MegaPixImage(file);
				var canvas = document.createElement("canvas");
				mpxImage.onrender = function(target) {
					//console.log(target);
					onPhotoDataSuccess(target.toDataURL(), currentPhoto, orientation);
					currentPhoto = "";
					$(event.target)[0].form.reset(); // reset so we can upload again in the same visit
				};
				mpxImage.render(canvas, {
					maxWidth: imageWidth,
					maxHeight: imageHeight,
					orientation: orientation
				});
			});
		}
	}

	/**
        sets the text in the span provided.
        @param span a jquery selection object  (e.g the result of a $("span.name"))
    */
	function setName(id) {
		var span = d3.select("#" + id + " .name");
		var currentName = span.html();
		var msg = "Enter the name of the person you want to meet: ",
			title = "Name a face";
		_prompt(msg, function(newName) {
			if (newName !== null) {
				span.style("background", "rgba(0,0,0,0.4)").html(newName);
				db.set(id + "name", newName);
			}
		}, title, currentName);
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
		$("body").css({
			width: width + "px",
			height: height + "px"
		});
		$(".tile, .back").css({
			width: tileWidth + "px",
			height: tileHeight + "px"
		});
	}

	function registerTileEvents() {
		// register click handler for tiles
		$(".tile").on("click", function(event) {
			if (event.target === this) {
				// if the name has never been set and user clicks on tile, set the name else take a picture
				var span = $("#" + this.id + " .name");
				var name = span.html();
				// if (name.trim().length === 0) { // DEMO BINGO
				// 	setName(this.id); // DEMO BINGO
				// } else { // DEMO BINGO
					currentPhoto = this.id;
					$("#photo-capture").click();
				// } // DEMO BINGO
			}
		});
		$("#photo-capture").on("change", gotPicture); // handle file input photos

		// register click handler for the name
		$(".name").on("click", function(event) { // DEMO BINGO
			// 	event.stopPropagation(); // stop event propagation so that parent div does not receive event // DEMO BINGO
			// 	setName(this.parentNode.id); // DEMO BINGO
			currentPhoto = this.parentNode.id;
			$("#photo-capture").click();
		});

		// register handler for share and about buttons
		$("#share").on("click", function(event) {
			//event.stopPropagation();
			var tiles = getCompletedTiles();
			if (tiles.length === 9) {
				share();
			} else {
				_confirm("You haven't got a full house yet – share anyway?", function(continueSharing) {
					if (continueSharing) {
						share();
					}
				}, "Share your image", "Share anyway", "Ok, I'll wait");
			}
		});

		$("#about").on("click", function(event) {
			event.stopPropagation();
			_alert(aboutText, "About");
		});
	}

	function updateName(tileId, name) {
		d3.select("#" + tileId + " .name").html(name).style("background", "rgba(0,0,0,0.4)");
	}

	function demoSelected(name) { // DEMO BINGO
		for (var i = 0; i < selectedDemos.length; i++) {
			if (selectedDemos[i] === name) {
				return true;
			}
		}
	}

	function loadSavedImages() {
		var showAboutText = false; // DEMO BINGO
		d3.selectAll(".tile").each(function() {
			var id = this.id;
			var name = db.get(id + "name"),
				image = db.get(id + "image");
			if (name) {
				updateName(id, name);
			} else { // DEMO BINGO
				var newName = "Demo";
				while(demoSelected(newName)) {
					newName = demos[Math.floor(Math.random()*demos.length)];
				}
				selectedDemos.push(newName);
				newName = "Demo " + newName;
				db.set(id + "name", newName);
				updateName(id, newName);
				showAboutText = true;
			}
			if (image) {
				updateImage(id, image);
			}
		});
		if (showAboutText) {
			setTimeout(function() { _alert(aboutText, "About");; }, 250); // DEMO BINGO - first load
		}
	}

	var app = {		
		// Application Constructor
		initialize: function() {
			this.bindEvents();
		},
		// Bind Event Listeners
		// Common events are: 'load', 'deviceready', 'offline', and 'online'.
		bindEvents: function() {
			$(document).ready(function() {
				loadSavedImages();
				registerTileEvents();
				fixTileWidthAndHeight(); // try to set the width and height of the tiles based on device
				FastClick.attach(document.body);
			});
		},
		onDeviceReady: function() {},
		// Update DOM on a Received Event
		receivedEvent: function(id) {}
	};
	module.exports = app;
});