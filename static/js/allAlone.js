var debug = false;
function log(m) { if (console && console.log && debug) console.log(m); }

var collectionHandle = "";
var resultsTemplate = null;

function displayLinksArray(data)
{
  // called when successful
  if (!data || data.length === 0) {
    $("#infoMsg").attr("class", "info");
    $("#infoMsg").html("<p>No Results Found</p>");
    $("#infoMsg").show();
    return;
  }
  // First we sort it by the at field then we're going to group it by date
  var dateGroups = []; // Array of objectcs matching {date:..., links:[...]}
  var curDate = null;
  var curLinks;
  for (var i = 0; i < data.length; ++i)
  {
    // We unset all the non compared fields
    var nextDate = new Date;
    nextDate.setTime(parseInt(data[i].at));
    nextDate.setHours(0);
    nextDate.setMinutes(0);
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);

    // If it's a different date let's start a new group of links
    if (!curDate || nextDate.getTime() != curDate.getTime())
    {
      var newDateGroup = {date:nextDate.strftime("%A, %B %d, %Y"), links:[]};
      dateGroups.push(newDateGroup);
      curLinks = newDateGroup.links;
      curDate = nextDate;
    }

    curLinks.push(data[i]);
  }
  $("#results").render({groups:dateGroups,groupClass:"dateGroup"}, resultsTemplate);
  $("#results").show();
}

function queryLinksCollection (queryString) {
    log("Querying: " + $.param({q:queryString||""}));
    $(".dateGroup").remove();
    $("#infoMsg").hide();
    var url = "/Me/" + collectionHandle + "/search?q=" + queryString;
    if (!queryString) url = "/Me/" + collectionHandle + "/?full=true&limit=100";
    $.ajax({
      "url": url,
      type: "GET",
      dataType: "json",
      success: displayLinksArray,
      error: function() {
        //called when there is an error
      }
    });
}

function getLinksSince(id)
{
    $(".dateGroup").remove();
    $("#infoMsg").hide();
    var url = "/Me/" + collectionHandle + "/since?id=" + id;
    $.ajax({
        "url":url,
        type:"GET",
        dataType:"json",
        success:function(data) {
          $("#newLinkCount").text(data.length + " New Links");
          $("#newCountHeader").show();
          $("#searchHeader").hide();
          displayLinksArray(data);
        }
    });
}

function findLinksCollection() {
    log("Finding the collection");
    $.ajax({
      url: "/providers?types=link",
      type: "GET",
      dataType: "json",
      success: function(data) {
          for (var i = 0; i < data.length; ++i) {
              if (data[i].provides.indexOf("link") > -1 && data[i].is === "collection") {
                  collectionHandle = data[i].id;
                  $("#loading").hide();
                  $("header").show();
                  break;
              }
          }
          // If we couldn't find a collection bail out
          if (collectionHandle === "") {
              showError("Could not find a valid links Collection to display.  Please contact your system administrator.");
              return;
          }
          if (window.location.hash.substr(0,4) == "#new") {
            getLinksSince(window.location.hash.substr(5));
          } else if (window.location.hash.substr(0,7) == "#search") {
            $("#linksQuery").val(window.location.hash.substr(8));
            queryLinksCollection(window.location.hash.substr(8));
          } else {
            queryLinksCollection();
          }
      },
      error: function() {
          showError("Could not find a valid links Collection to display.  Please contact your system administrator.");
      }
    });
}

function showError(errorMessage) {
    $("#infoMsg").html("<p>" + errorMessage + "</p>");
    $("#infoMsg").attr("class", "error");
    $("#infoMsg").show();
    $("#results").hide();
    $("#loading").hide();
}

Array.prototype.clean = function(deleteValue) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] == deleteValue) {
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};

$(function()
{
    resultsTemplate = $p("#results").compile({
        "div.templateDateGroup" : {
            // Loop on each date group
            "group<-groups" : {
                "@class":"groupClass",
                "div.dateInfo":"group.date",
                "div.linkInfo" : {
                    // On each date group we loop the links
                    "link<-group.links": {
                        "img.providerIcon@src":function(arg, item) {
                            var images = {
                                "facebook":"img/facebook.png",
                                "twitter":"img/twitter.png"
                            };
                            return (arg.item.encounters.length > 0) ? images[arg.item.encounters[arg.item.encounters.length - 1].network] : "img/1x1-pixel.png";
                        },
                        "img.favicon@src":"link.favicon",
                        "a.expandedLink":function(arg) {
                            if (arg.item.link.length > 100) {
                                return arg.item.link.substring(0, 100) + "...";
                            } else {
                                return arg.item.link;
                            }
                        },
                        "a@href":"link.link",
                        "span.linkDescription":function(arg) {
                            if(arg.item.title == "Incompatible Browser | Facebook") return arg.item.link;
                            if (arg.item.title && arg.item.title.length > 150) {
                                return arg.item.title.substring(0, 100) + "...";
                            } else if (arg.item.title) {
                                return arg.item.title;
                            } else {
                                return arg.item.link;
                            }
                        },
                        "span.linkFrom":function(arg) {
                            var dedup = {};
                            return "Shared <em>" + getSincePrettified(arg.item.encounters[arg.item.encounters.length - 1].at) + "</em> by " + arg.item.encounters.map(function(item) {
                                if(dedup[item.from]) return false;
                                dedup[item.from] = true;
                                var base = (item.network == "twitter") ? "http://twitter.com/#" : "http://facebook.com/";
                                var id = (item.network == "twitter") ? item.via.user.screen_name : item.fromID;
                                return '<a href="'+base+id+'" target="_blank">'+item.from+'</a>';
                            }).clean(false).join(", ");
                        },
                        "span.linkFrom@style":function(arg) {
                            return arg.item.encounters[arg.item.encounters.length - 1].from ? "" : "display:none";
                        },
                        "p.linkSummary":function(arg) {
                          var item = arg.item;
                          if (typeof item.embed === "undefined") return;
                          if (item.embed.description)
                            return "<p>" + item.embed.description + "</p>";
                        },
                        "div.embedView":function(arg) {
                          var item = arg.item;
                          if (typeof item.embed === "undefined") return;
                          if (item.embed.html) {
                            return item.embed.html;
                          } else if (item.embed.thumbnail_url) {
                            return "<img src='" + item.embed.thumbnail_url + "' />";
                          }
                        }
                    }
                }
            }
        }
    });

    $("#showAllLink").click(function() {
        $("#newCountHeader").hide();
        $("#searchHeader").show();
        queryLinksCollection();
        return false;
    });
    $("#searchForm").submit(function() {
        queryLinksCollection($("#linksQuery").val());
        return false;
    });
    findLinksCollection();
    $("#searchLinks").click(function(){
        queryLinksCollection($("#linksQuery").val());
        return false;
    });
});

function hideMe() {
    $(event.srcElement).hide();
}

function showMe() {
    $(event.srcElement).show();
}

function getSincePrettified(timestamp) {
    var tip;
    var timeDiff = Date.now() - timestamp;
    if (timeDiff < 60000) {
        tip = 'less than a minute ago';
    } else if (timeDiff < 3600000) {
        var min = Math.floor(timeDiff / 60000);
        tip =  min + ' minute' + (min > 1?'s':'') + ' ago';
    } else if (timeDiff < 43800000) {
        var hour = Math.floor(timeDiff / 3600000);
        tip =  hour + ' hour' + (hour > 1?'s':'') + ' ago';
    } else {
        var d = new Date();
        d.setTime(timestamp);
        tip = d.toString();
    }
    return tip;
}
