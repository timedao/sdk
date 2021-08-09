import contract from "truffle-contract";
import TimeAtom from "./TimeAtom.json";
import { sha256 } from "js-sha256";
import TimeAtomConfig from "./config-timeatom";

const crypto = require("crypto");
const algorithm = "aes-256-ctr";
const PROXY_ADDRESS = new TimeAtomConfig().upgradeProxy_address_xdai;

export default class TimeAtomSdk {
  constructor(web3Provider) {
    if (web3Provider === null) return;
    this.web3Provider = web3Provider;
    this.TimeAtomContract = contract(TimeAtom);
    this.TimeAtomContract.setProvider(web3Provider.currentProvider);
    this.TimeAtomContract.defaults({ from: web3Provider.eth.defaultAccount }); 
  }

  checkIfExists(hashKey){
    return new Promise((resolve, reject) => {
      this.TimeAtomContract.at(PROXY_ADDRESS)
      .then((ad) => {
        return ad.checkHashKey(hashKey)
      }).then((result) => {    
        resolve(result)
      })
    })   
      .catch((error) => {
        console.log('error: ',error)
      })
  }
  
  encrypt(text, secretKey) {
    const iv = crypto.randomBytes(16);
    let key = crypto
      .createHash("sha256")
      .update(String(secretKey))
      .digest("base64")
      .substr(0, 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  }

  decrypt(hash, secretKey) {
    var encryptedArray = hash.split(":");
    var iv = new Buffer(encryptedArray[0], "hex");
    hash = new Buffer(encryptedArray[1], "hex");
    let key = crypto
      .createHash("sha256")
      .update(String(secretKey))
      .digest("base64")
      .substr(0, 32);

    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, "hex")
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(hash, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString();
  }

  // returns the fees calculated in Dai/USD
async calculateFee(endDate) { 
  return new Promise((resolve, reject) => {
    this.TimeAtomContract.at(PROXY_ADDRESS)
      .then(async (ad) => {
        return ad.calculateFee(endDate).catch((error) => {
          resolve({ error: error });
        });
      })
      .catch((error) => {
        resolve({ error: error });
      })
      .then((result) => {   
        let fee_in_dai = result.toNumber()/Math.pow(10,18);  
        resolve(fee_in_dai);
      });
  }).catch((error) => {
    console.log(error);
  });
}

// retrieves an atom
  async retrieve(hashedname) {
    return new Promise((resolve, reject) => {
      this.TimeAtomContract.at(PROXY_ADDRESS)
        .then(async (ad) => {
          return ad.getAtom(hashedname).catch((error) => {
            resolve({ error: error });
          });
        })
        .catch((error) => {
          resolve({ error: error });
        })
        .then((result) => {
          let decoded = this.web3Provider.eth.abi.decodeParameters(
            [
              {
                type: "string",
                name: "timelocked_content",
              },
              {
                name: "opening_date",
                type: "uint",
              },
            ],
            result
          );
          result = decoded;
          let event;
          if (result.timelocked_content.length > 1) {
            event = "BoxOpened";
          } else if (result.opening_date > 0) event = "BoxLocked";
          else event = "BoxNotFound";
          result.event = event;
          switch (event) {
            case "BoxNotFound":
              result.BoxNotFound = true;
              result.boxIsReady = false;
              break;
            case "BoxLocked":
              result.BoxLocked = true;
              result.boxIsReady = false;
              break;
            case "BoxOpened":
              result.boxIsReady = true;
              break;
          } 
     
          //return result;
          resolve(result);
        });
    }).catch((error) => {
      console.log(error);
    });
  }

/* Retrieves the public content of an atom */
  async getPublicContent(hashedname) { 
    return new Promise((resolve, reject) => {
      this.TimeAtomContract.at(PROXY_ADDRESS)
        .then(async (ad) => {
          return ad.getPublicContent(hashedname).catch((error) => {
            resolve({ error: error });
          });
        })
        .catch((error) => {
          resolve({ error: error });
        })
        .then((result) => {
          let decoded = this.web3Provider.eth.abi.decodeParameters(
            [
              {
                type: "string",
                name: "public_content",
              },
              {
                name: "opening_date",
                type: "uint",
              },
            ],
            result
          );    
          result = decoded;         
          if (result.public_content.length > 1) {
            result.event = "BoxOpened";         
          } else result.event = "BoxNotFound";           
          resolve(result);
        });
    }).catch((error) => {
      console.log(error);
    });
  }

/* Retrieves the public keys of an Atom */
  async store(name,pubstr, pkstr, opening_date, options = { gas: 1000000 }) {      
    let total_price_usd = await this.calculateFee(opening_date);
    const fee = total_price_usd * Math.pow(10, 18);
    return new Promise((resolve, reject) => {
      this.TimeAtomContract.at(PROXY_ADDRESS)
        .then(async (ad) => {
          return ad
            .makeAtom(name, pubstr,pkstr, opening_date, {
              gas: options.gas,
              value: fee,
            })
            .catch((error) => {
              console.log(error);
              resolve({ BoxReady: false });
            });
        })
        .catch((error) => {
          console.log(error);
          resolve({ BoxReady: false });
        })
        .then((result) => {         
          if (typeof result == "undefined") result = { BoxReady: false };
          else if (result.logs.length) {
            result.logs.forEach((log) => {
              switch (log.event) {
                case "AlreadyRegistered":
                  result.nameAlreadyExists = true;
                  break;
                case "AtomReady":
                  result.BoxReady = log.args._value;
              }
            });
            result.opening_date = opening_date;
          }
          resolve(result);
        });
    }).catch((error) => {
      console.log(error);
      return { BoxReady: false };
    });
  }
}