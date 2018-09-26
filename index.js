var http = require('http');
var express = require('express');
var app = express();

app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});
	
app.use(express.static('htdocs'));

function calc(height, temp){
var pecentage = 0;
var cache = (0.01)*(height-9);
var snow = Math.pow(2.718, cache);
var snow = snow*height;
var cache = (0.3)*(25-temp);
var deg = Math.pow(2.718, cache);
snow = snow+deg;
snow = Math.round(snow);
if(snow<=1){
snow = 0;
}
if(snow>=100){
snow = 99;
}
return snow;
}

function newFormula(startHour, windSpeed, snowLevel, snowRate, avgTemp, latitude){
	var points = 0.0;
	if(startHour>=3 && startHour<9){
		points += 4;
	}else if(startHour>=9 && startHour<15){
		points+=1;
	}else if(startHour>=25 && startHour<21){
		points+=2;
	}else{
		points+=3;
	}
	points = points + windSpeed*0.4;
	points = points + snowLevel*2;
	if(latitude<35){
		points = points + 5;
	}else if(latitude>=35 && latitude<=40){
		points = points + 1.5;
	}else if(latitude>=40 && latitude<=45){
		points = points - 1.5;
	}else{
		points = points - 5;
	}
	if(snowRate>=0.1 && snowRate<0.75){
		points++;
	}else if(snowRate>=0.75&&snowRate<=1.25){
		points += 2;
	}else if(snowRate>1.25){
		points += 4;
	}
	var tempPoints = 3-(avgTemp/5);
	points += (tempPoints*2);
	if(points/24<0){
		return 0.01;
	}
	return points/24;
}

function getSnowPeriods(fiveDayOBJ){
	var returnOBJArray = new Array();
	var isSnowing = false;
	var index = 0;
	if(fiveDayOBJ.cod == 200){
	for(i = 0; i<fiveDayOBJ.list.length; i++){
		if(fiveDayOBJ.list[i].weather[0].id == 511 || (fiveDayOBJ.list[i].weather[0].id >= 600 && fiveDayOBJ.list[i].weather[0].id <=622) || (fiveDayOBJ.list[i].snow != undefined)){
			if(isSnowing){
				returnOBJArray[index].duration += 3;
				if(fiveDayOBJ.list[i].snow["3h"]!=undefined){

					returnOBJArray[index].cover += fiveDayOBJ.list[i].snow["3h"];
					
				}
				if(fiveDayOBJ.list[i].weather[0].id == 511 || fiveDayOBJ.list[i].weather[0].id == 611){
					returnOBJArray[index].cover += 6;	
				}
				returnOBJArray[index].windSpeed = (returnOBJArray[index].windSpeed + fiveDayOBJ.list[i].wind.speed)/2;
				returnOBJArray[index].temp = (returnOBJArray[index].temp + fiveDayOBJ.list[i].main.temp)/2;
			}else{
				isSnowing = true;
				cov = 0;
				if(fiveDayOBJ.list[i].snow!=undefined){
					cov += fiveDayOBJ.list[i].snow["3h"];
				}
				if(fiveDayOBJ.list[i].weather[0].id == 511 || fiveDayOBJ.list[i].weather[0].id == 611){
					cov += 6;	
				}
				startTime = new Date(fiveDayOBJ.list[i].dt*1000);
				startHour = startTime.getHours();
				windSpeed = fiveDayOBJ.list[i].wind.speed;
				temperature = fiveDayOBJ.list[i].main.temp;
				returnOBJArray.push({starttimestamp:fiveDayOBJ.list[i].dt*1000,startHourNum:startHour,duration:3, cover:cov, windSpeed:windSpeed, temp:temperature});
			}
		}else{
			if(isSnowing){
				isSnowing = false;
				index++;
			}
		}
	}
	}
	return returnOBJArray;
}


forecast = function(zip,callback){
var options = {
	host : 'api.openweathermap.org',
	path : '/data/2.5/forecast?APPID=1a10e2760a7cc1726648639d607bd429&zip=' + zip + ',US&units=imperial'
}

var data = '';
var request = http.request(options, function (res) {
   
    res.on('data', function (chunk) {
        data += chunk;
    });
    res.on('end', function () {
		var results = JSON.parse(data);
		var snowData = getSnowPeriods(results);
		var percentArray = new Array();
		for(i = 0; i<snowData.length; i++){
			percentArray.push({startTS:snowData[i].starttimestamp,pecentage:newFormula(snowData[i].startHourNum,snowData[i].windSpeed,snowData[i].cover,snowData[i].cover/snowData[i].duration, snowData[i].temp, results.city.coord.lat)});
		}
		var fivedayforcast = [0,0,0,0,0];
		var remark = ["No Snow","No Snow","No Snow","No Snow","No Snow"];
		for(j = 0; j<percentArray.length; j++){
			var tempindex = 0;
			//console.log(percentArray[j].startTS);
			while(percentArray[j].startTS - 86400000>=Date.now()){
			percentArray[j].startTS = percentArray[j].startTS - 86400000;
			tempindex++;
			}
			fivedayforcast[tempindex] = percentArray[j].pecentage;
		}
		for(var n = 0; n<fivedayforcast.length; n++){
			if(fivedayforcast[n]>=0.01 && fivedayforcast[n]<0.5){
				remark[n] = "There is snow but unlikely for a snow day.";
				if(n<4 && fivedayforcast[n+1]>=0.5 && fivedayforcast[n+1]>fivedayforcast[n]){
					remark[n] = "Although snow day is currently unlikely, predictions are subject to change.";
				}
			}else if(fivedayforcast[n]>=0.5 && fivedayforcast[n]<0.8){
				remark[n] = "Your school might be subject to delay or even cancellation. Check your school website.";
			}else if(fivedayforcast[n]>=0.8){
				remark[n] = "There is most likely a snow day. Check your school website.";
			}else{
				
			}
		}
		var resObj = new Object();
		if(results.cod == 200){
		resObj.city = results.city.name;
		}else{
			resObj.city = "Unknown";
		}
		resObj.percentage = fivedayforcast;
		resObj.remark = remark;
		callback(false, JSON.stringify(resObj));
    });
});

request.on('error', function (e) {
   console.log(e);
   callback(true, false);
});

request.end();

}

app.get("/predict", function(req, res){
	forecast(req.query.zip, function(error, snowpercent){
		if (error) {
			console.log(error);
		}
		res.send(snowpercent);
	});
});

app.get("/now", function(req, res){
	var zip = req.query.zip;
	var options = {
	host : 'api.openweathermap.org',
	path : '/data/2.5/weather?APPID=1a10e2760a7cc1726648639d607bd429&q=' + zip + ',US&units=imperial'
}
	
	var data = "";
	var getData = http.request(options, function(sys){
		
		sys.on('data', function(chunk){
			data += chunk;
		});
		
		sys.on('end', function(){
			var currentData = JSON.parse(data);
			var pack = {Temperature:currentData.main.temp, Weather:currentData.weather[0].description};
			if(currentData.status == 200){
			var id = currentData.weather[0].id;
			if(id>=200 && id<300){
				pack.Weather = "Thunderstorm";
			}else if(id>=300 && id<400){
				pack.Weather = "Drizzle";
			}else if(id>=500 && id<600){
				pack.Weather = "Rain";
			}else if(id>=600 && id<700){
				pack.Weather = "Snow";
			}else if(id == 800){
				pack.Weather = "Clear";
			}else if(id>=801 && id<=803){
				pack.Weather = "Cloudy";
			}else if(id == 804){
				pack.Weather = "Overcast";
			}
			}else{
				pack.weather = "Unknown";
			}
			
			res.send(pack);
		});
	});
	
	getData.end();
});


//console.log(newFormula(19, 15, 12, 12/14, 32, 45.8));

app.listen(process.env.PORT||80);

