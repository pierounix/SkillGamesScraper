const puppeteer = require('puppeteer');
const db = require('./controller');

var SkillUrl = 'https://cardgames.lottomatica.it/skill/lobby/lobby.php?codice_conto=0003459677&user=508319&accesso=hrJkqUZaZcie8sLU&ultimo_login=2019-04-28+08%3A33%3A54&conc=LOTTOMATICA&id_network=1&prodotto=skill&mod=M&gioco=SC&skin=LOTTOMATICA&tipo=P&lang=it&canale=web';

(async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(SkillUrl, { waitUntil: 'networkidle0' });

  // Chiudo Alert di benvenuto
  let spanAlert = await findByText(page,'CHIUDI','span');
  await page.evaluate((el) => {
    return el.click()
  }, spanAlert);

  var array_premi = [];

  // Apro la tabella dei Sit&Go
  const divSitGo = await findByText(page,'SIT & GO','div');
  await page.evaluate((el) => {
    return el.click()
  }, divSitGo);

  
  var oldmap = new Map(); // Contiene i tornei letti all'iterazione precedente
  var map = new Map();    // Contiene i tornei letti all'iterazione attuale

  var first_iteration = true;

  while(true) {

  // Seleziono il div che contiene tutta la tabella
  const divRows = await page.$x("//div[starts-with(@id,'riga_')]");

  map = new Map();
 
  // Cicla su ogni riga/tavolo
  for (var i=0; i < divRows.length; i++) {

    await page.evaluate((el) => {
      return el.click()
    }, divSitGo);

    // Controllo se la riga è attiva
    const displayHandle = await page.evaluateHandle(element => element.getAttribute('style'), divRows[i]);
    const display = await displayHandle.jsonValue();
    if( display == 'display:none;')
        continue;

    //Leggo tipo torneo
    let tipo_torneo_div= await divRows[i].$('.elencoLobbyCellaDescrizione');
    const TIPO_TORNEO = await (await tipo_torneo_div.getProperty('textContent')).jsonValue();

    if (TIPO_TORNEO == 'Premio Matto') {

      // Leggo Codice Torneo
      let id_riga = await divRows[i].getProperty('id');
      let id_riga_string = await id_riga.jsonValue();
      let CODICE_TORNEO = id_riga_string.substring(5,17);
        
      // Leggo costo torneo
      let id_costo_torneo = '#'+ 'cella_' +CODICE_TORNEO + '_costo';
      const div_costo_torneo = await page.$(id_costo_torneo);
      const costo_torneo_text_html = await div_costo_torneo.getProperty('innerText');
      const costo_torneo_string = await costo_torneo_text_html.jsonValue();
      const COSTO_TORNEO = convertPrice(costo_torneo_string);

      // Inserisco di default il metto il premio minimo
      const DEFAULT_PREMIO = getDefaultPremio(COSTO_TORNEO);
      var torneo = { "id_torneo": CODICE_TORNEO, 
                      "costo": COSTO_TORNEO,
                      "premio": DEFAULT_PREMIO };
      
      if (first_iteration) {
        oldmap.set(CODICE_TORNEO,torneo);
        } else {
        map.set(CODICE_TORNEO,torneo);
        }
      }
    }
    
    if(first_iteration) {
      first_iteration = false;
      // console.log(oldmap.size + ' ' +map.size);
    } else {
      // console.log(oldmap.size+ ' ' +map.size);
      oldmap = compareAndInsert(oldmap,map);
    }

    // Leggo la chat e aggiorno i premi
    const divMsgs = await page.$x("//div[starts-with(@id,'msg_')]");

    for (var i=0; i < divMsgs.length; i++) {

      const tipo_msg = await divMsgs[i].$('b');
      const b_text_elem = await tipo_msg.getProperty('innerText');
      const b_text_elem_json = await  b_text_elem.jsonValue();
      const b_text = getText(b_text_elem_json);
      if ( b_text == 'Premio Matto')  {
        const font_elem = await divMsgs[i].$('font');
        const font_hanlde = await page.evaluateHandle(element => element.getAttribute('color'), font_elem);
        const font = await font_hanlde.jsonValue();
        if (font == '#FF0000') {
          const info_premio_elem = await font_elem.getProperty('innerText');
          const info_premio_json = await  info_premio_elem.jsonValue();
          const info_premio = getText(info_premio_json);
          var torneo = getInfoPremio(info_premio);
          if (!array_premi.includes(torneo.id_torneo)) {
            db.updateTorneo(torneo,function(err,rows) {
              if(err) { console.log(err)}
              else{}
              });
              array_premi.push(torneo.id_torneo);
          }
        }
      }

    }


  await page.waitFor(2000);
  
  }


  /*
  await Promise.all([
    page.click('#login-button'),
    page.waitForSelector('form[name="loginForm"]')
    ]);
  await page.type('input[name="gkl"]', 'zipzero0');
  await page.type('input[name="gkp"]', 'Dente743833')
  //await browser.close();
  */
})();


// find the link, by going over all links on the page
async function findByText(page, textString, element) {
  const links = await page.$$(element)
  for (var i=0; i < links.length; i++) {
    let valueHandle = await links[i].getProperty('innerText');
    let id = await links[i].getProperty('id');
    let linkText = await valueHandle.jsonValue();
    let idText = await id.jsonValue();
    const text = getText(linkText);
    if (textString == text) {
      return links[i];
    }
  }
  return null;
}

// Normalizing the text
function getText(linkText) {
  linkText = linkText.replace(/\r\n|\r/g, "\n");
  linkText = linkText.replace(/\ +/g, " ");

  // Replace &nbsp; with a space 
  var nbspPattern = new RegExp(String.fromCharCode(160), "g");
  return linkText.replace(nbspPattern, " ");
}

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

 function convertPrice(priceText) {
  let price = 0;
  priceText = priceText.substring(2);
  switch(priceText) {
    case "5,00":
      price = 5;
      break;
    case "10,00":
      price = 10;
      break;
    default:
      price = 1;
  }
  return price; 
}

 function convertPremio(priceText) {
    let price = 0;
    priceText = priceText.substring(0,priceText.length-1);
    switch(priceText) {
      case "5.00":
        price = 5;
        break;
      case "10.00":
        price = 10;
        break;
      case "35.00":
        price = 35;
        break;
      case "50.00":
        price = 50;
        break;
      case "100.00":
        price = 100;
        break;
      case "250.00":
        price = 250;
        break;
      case "500.00":
        price = 500;
        break;
      case "700.00":
        price = 1000;
        break;
      case "3500.00":
        price = 5000;
        break;
      default:
        price = 1;
    }
    return price; 
}

function getDefaultPremio(cost) {
  let default_price = 2.50;
  switch(cost) {
    case 5:
    default_price = 12.50;
      break;
    case 10:
    default_price = 25;
      break;
    default:
      price = 2.50;
  }
  return default_price; 
}

function compareAndInsert(oldmap, newmap) {
  
  // Per ogni elemento della vecchia mappa, se non è presente nella nuova, viene persistito
  for (const k of oldmap.keys()) {
    if(!newmap.has(k)) {
      db.addTorneo(oldmap.get(k),function(err,rows) {
        if(err) { console.log(err)}
        else{}
        });
    }
  }
  return newmap;

}

function getInfoPremio(info_string) {
  info = info_string.match(/\S+/g);
  utente = info[0];
  premio = convertPremio(info[3]);
  codice_torneo = info[6].substring(0,info[6].length-1)
  return {id_torneo: codice_torneo, costo:null, premio:premio, orario:null, utente:utente};

}