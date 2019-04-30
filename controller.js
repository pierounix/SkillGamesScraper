var db = require('./database.js');


var gestioneTorneo = {

    getTornei:function(callback) {
        return db.query("Select * from torneo", callback); 
        },
        
    getTorneoById:function(id_torneo,callback) {
        return db.query("select * from torneo where Id_torneo=?", [id_torneo], callback);
        },
    
    addTorneo:function(torneo, callback) {
            return db.query("Insert into torneo values(?,?,?,?,?)",[torneo.id_torneo, 
                                                                    torneo.costo, 
                                                                    torneo.premio, 
                                                                    new Date(), 
                                                                    torneo.utente]
                                                                    ,callback);
            },
    
    updateTorneo:function(torneo,callback){
                return db.query("update torneo set premio=?, utente=? where Id_torneo=?",
                                [torneo.premio,
                                torneo.utente,
                                torneo.id_torneo]
                                ,callback);
               }
    }

    module.exports = gestioneTorneo;