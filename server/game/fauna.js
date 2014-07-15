var extend = require('util')._extend;

var FaunaModel = require('../api/fauna/fauna.model');

(function(faunaManager) {
    var SPAWNING_TIME = 10;
    var SAFE_DISTANCE = 5;
    var spawnCountdown = SPAWNING_TIME;
    var animalCount = 0;

    faunaManager.faunas = [];
    var deceased_faunas = [];

    var faunaAttributes = {
        wolf:{
            speed:2,
            hunger:20,
            attack:5,
            defense:3
        },
        rabbit:{
            speed:3,
            hunger:30,
            attack:2,
            defense:1
        }
    };

    var Distance = function(coords1, coords2) {
        return Math.sqrt(Math.pow(coords1.x - coords2.x, 2) + Math.pow(coords1.y - coords2.y, 2));
    };

    var Normalize = function(value) {
        if (value === 0)
            return value;
        else
            return value/Math.abs(value);
    };

    var Fauna = (function() {
        function Fauna(genome) {
            this.name = genome.name;
            this.type = genome.type;
            this.attributes = genome.attributes;
            this.coords = genome.coords;


        }

        Fauna.prototype.update = function(game) {
            this.attributes.hunger--;
            //console.log("name: " + this.name + "  hunger: " + this.attributes.hunger);
            if (this.attributes.hunger < 0)
                return; //dead things don't move

            var danger;
            var food;

            danger = 'wolf';
            if (this.type == 'wolf') {
                food = 'rabbit';
            }
            if (this.type == 'rabbit') {
                food = 'berrybush'
            }

            var nearestDanger = this.FindNearest(danger);
            var nearestFood = this.FindNearest(food, game.flora.floras);

            var awayFromDanger = {};
            awayFromDanger.x = Normalize(this.coords.x - nearestDanger.coords.x);
            awayFromDanger.y = Normalize(this.coords.y - nearestDanger.coords.y);

            var towardsFood = {};
            towardsFood.x = Normalize(nearestFood.coords.x - this.coords.x);
            towardsFood.y = Normalize(nearestFood.coords.y - this.coords.y);

            if (Distance(awayFromDanger, this.coords) < SAFE_DISTANCE) {
                this.coords.x += awayFromDanger.x;
                this.coords.y += awayFromDanger.y;
            } else {
                this.coords.x += towardsFood.x;
                this.coords.y += towardsFood.y;
            }

            this.coords = game.validate(this.coords);

            // move away from predator - 5
            // move towards cover - 2
            // move towards food - 4
            // move towards other like kinds - 2
            // move away from borders - 1
        };

        Fauna.prototype.FindNearest = function (type, floras) {
            var entities = faunaManager.faunas.concat(floras||[]);
            var self = this;
            var nearest;
            var nearestDist = Number.MAX_VALUE;

            entities.forEach(function(entity) {
                if (entity.type == type && entity.name != self.name) {
                    var dist = Distance(entity.coords, self.coords);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = entity;
                    }
                }
            });
            return nearest;
        };

        return Fauna;
    })();

    faunaManager.init = function(game) {
        FaunaModel.find(function (err, faunas) {
           if (err) {
               console.log("Error: Getting faunas from db.");
           }

            faunas.forEach(function (item) {
               faunaManager.faunas.push(new Fauna(item));
            });
        });
    };

    faunaManager.update = function(game) {
        // update all faunas
        for (var i=faunaManager.faunas.length-1; i>0; i--) {
            faunaManager.faunas[i].update(game);

            if (faunaManager.faunas[i].attributes.hunger < 0) {
                deceased_faunas.concat(faunaManager.faunas.splice(i, 1)); // remove animal from faunas and add to dead list
            }
        }

        // spawn new animal when countdown reaches 0, reset countdown
        if (--spawnCountdown <= 0) {
            var genome = {
                name: animalCount++ + 'wolf',
                type: 'wolf',
                attributes: faunaAttributes['wolf'],
                coords: game.randCoord()
            };
            FaunaModel.create(genome, function(err, res) {
                if (err)
                    console.log("Error: Failed to add a new " + genome + " to the db.")
            });

            genome = {
                name: animalCount++ + 'rabbit',
                type: 'rabbit',
                attributes: faunaAttributes['rabbit'],
                coords: game.randCoord()
            };
            FaunaModel.create(genome, function(err, res) {
                if (err)
                    console.log("Error: Failed to add a new " + genome + " to the db.")
            });

            spawnCountdown = SPAWNING_TIME;
        }
    };

})(module.exports);