var _srp = {};

/////// PUBLIC CLIENT

/**
 * Generate a new SRP verifier. Password is the plaintext password.
 *
 * options is optional and can include:
 *   in for testing.  Random UUID if not provided.
 * - salt: String. A salt to use.  Mostly this is passed in for
 *   testing.  Random UUID if not provided.
 * - SRP parameters (see _defaults and paramsFromOptions below)
 */
_srp.generateVerifier = function (password, options) {
  var params = paramsFromOptions(options);

  var salt = (options && options.salt) || random16byteHex.random();

  var x = params.hash(salt + params.hash(password));
  var xi = new BigInteger(x, 16);
  var v = params.g.modPow(xi, params.N);

  return {
    salt:salt,
    verifier:v.toString(16)
  };
};

/**
 * Generate a new SRP client object. Password is the plaintext password.
 *
 * options is optional and can include:
 * - a: client's private ephemeral value. String or
 *      BigInteger. Normally, this is picked randomly, but it can be
 *      passed in for testing.
 * - SRP parameters (see _defaults and paramsFromOptions below)
 */
_srp.Client = function (password, options) {
  var self = this;
  self.params = paramsFromOptions(options);
  self.password = password;

  // shorthand
  var N = self.params.N;
  var g = self.params.g;

  // construct public and private keys.
  var a, A;
  if (options && options.a) {
    if (typeof options.a === "string") {
      a = new BigInteger(options.a, 16);
    }
    else if (options.a instanceof BigInteger) {
      a = options.a;
    }
    else {
      throw new Error("Invalid parameter: a");
    }

    A = g.modPow(a, N);

    if (A.mod(N) === 0) {
      throw new Error("Invalid parameter: a: A mod N == 0.");
    }

  } else {
    while (!A || A.mod(N) === 0) {
      a = randInt();
      A = g.modPow(a, N);
    }
  }

  self.a = a;
  self.A = A;
  self.Astr = A.toString(16);
};

/**
 * Initiate an SRP exchange.
 *
 * returns { A: 'client public ephemeral key. hex encoded integer.' }
 */
_srp.Client.prototype.startExchange = function () {
  var self = this;

  return {
    A:self.Astr
  };
};

/**
 * Respond to the server's challenge with a proof of password.
 *
 * challenge is an object with
 * - B: server public ephemeral key. hex encoded integer.
 * - salt: user's salt.
 *
 * returns { M: 'client proof of password. hex encoded integer.' }
 * throws an error if it got an invalid challenge.
 */
_srp.Client.prototype.respondToChallenge = function (challenge) {
  var self = this;

  // shorthand
  var N = self.params.N;
  var g = self.params.g;
  var k = self.params.k;
  var H = self.params.hash;

  // XXX check for missing / bad parameters.
  self.salt = challenge.salt;
  self.Bstr = challenge.B;
  self.B = new BigInteger(self.Bstr, 16);

  if (self.B.mod(N) === 0) {
    throw new Error("Server sent invalid key: B mod N == 0.");
  }

  var u = new BigInteger(H(self.Astr + self.Bstr), 16);
  var x = new BigInteger(H(self.salt + H(self.password)), 16);

  var kgx = k.multiply(g.modPow(x, N));
  var aux = self.a.add(u.multiply(x));
  var S = self.B.subtract(kgx).modPow(aux, N);
  var M = H(self.Astr + self.Bstr + S.toString(16));
  var HAMK = H(self.Astr + M + S.toString(16));

  self.S = S;
  self.HAMK = HAMK;

  return {
    M:M
  };
};

/**
 * Verify server's confirmation message.
 *
 * confirmation is an object with
 * - HAMK: server's proof of password.
 *
 * returns true or false.
 */
_srp.Client.prototype.verifyConfirmation = function (confirmation) {
  var self = this;

  return (self.HAMK && (confirmation.HAMK === self.HAMK));
};

/////// PUBLIC SERVER

/**
 * Generate a new SRP server object. Password is the plaintext password.
 *
 * options is optional and can include:
 * - b: server's private ephemeral value. String or
 *      BigInteger. Normally, this is picked randomly, but it can be
 *      passed in for testing.
 * - SRP parameters (see _defaults and paramsFromOptions below)
 */
_srp.Server = function (verifier, options) {
  var self = this;
  self.params = paramsFromOptions(options);
  self.verifier = verifier;

  // shorthand
  var N = self.params.N;
  var g = self.params.g;
  var k = self.params.k;
  var v = new BigInteger(self.verifier.verifier, 16);

  // construct public and private keys.
  var b, B;
  if (options && options.b) {
    if (typeof options.b === "string") {
      b = new BigInteger(options.b, 16);
    }
    else if (options.b instanceof BigInteger) {
      b = options.b;
    }
    else {
      throw new Error("Invalid parameter: b");
    }

    B = k.multiply(v).add(g.modPow(b, N)).mod(N);

    if (B.mod(N) === 0) {
      throw new Error("Invalid parameter: b: B mod N == 0.");
    }

  } else {
    while (!B || B.mod(N) === 0) {
      b = randInt();
      /* @todo remove after */
      b = new BigInteger("5bfa31806d8c46b1ac56a15886340926", 16);

      B = k.multiply(v).add(g.modPow(b, N)).mod(N);
    }
  }

  self.b = b;
  self.B = B;
  self.Bstr = B.toString(16);

};

/**
 * Issue a challenge to the client.
 *
 * Takes a request from the client containing:
 * - A: hex encoded int.
 *
 * Returns a challenge with:
 * - B: server public ephemeral key. hex encoded integer.
 * - salt: user's salt.
 *
 * Throws an error if issued a bad request.
 */
_srp.Server.prototype.issueChallenge = function (request) {
  var self = this;

  // XXX check for missing / bad parameters.
  self.Astr = request.A;
  self.A = new BigInteger(self.Astr, 16);

  if (self.A.mod(self.params.N) === 0) {
    throw new Error("Client sent invalid key: A mod N == 0.");
  }

  // shorthand
  var N = self.params.N;
  var H = self.params.hash;

  // Compute M and HAMK in advance. Don't send to client yet.

  var u = new BigInteger(H(self.Astr + self.Bstr), 16);
  var v = new BigInteger(self.verifier.verifier, 16);

  var avu = self.A.multiply(v.modPow(u, N));

  self.S = avu.modPow(self.b, N);
  self.M = H(self.Astr + self.Bstr + self.S.toString(16));
  self.HAMK = H(self.Astr + self.M + self.S.toString(16));

  return {
    salt:self.verifier.salt,
    B:self.Bstr
  };
};

/**
 * Verify a response from the client and return confirmation.
 *
 * Takes a challenge response from the client containing:
 * - M: client proof of password. hex encoded int.
 *
 * Returns a confirmation if the client's proof is good:
 * - HAMK: server proof of password. hex encoded integer.
 * OR null if the client's proof doesn't match.
 */
_srp.Server.prototype.verifyResponse = function (response) {
  var self = this;

  if (response.M !== self.M) {
    return null;
  }

  return {
    HAMK:self.HAMK
  };
};

/////// INTERNAL

/**
 * Default parameter values for SRP.
 *
 */
_srp._defaults = {
  hash:function (x) {
    return SHA256(x).toLowerCase();
  },
  N:new BigInteger("EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE48E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B297BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9AFD5138FE8376435B9FC61D2FC0EB06E3", 16),
  g:new BigInteger("2")
};
_srp._defaults.k = new BigInteger(
  _srp._defaults.hash(
    _srp._defaults.N.toString(16) +
      _srp._defaults.g.toString(16)),
  16);

/**
 * Process an options hash to create SRP parameters.
 *
 * Options can include:
 * - hash: Function. Defaults to SHA256.
 * - N: String or BigInteger. Defaults to 1024 bit value from RFC 5054
 * - g: String or BigInteger. Defaults to 2.
 * - k: String or BigInteger. Defaults to hash(N, g)
 */
var paramsFromOptions = function (options) {
  if (!options) {
    // fast path
    return _srp._defaults;
  }

  var ret = _.extend({}, _srp._defaults);

  _.each(['N', 'g', 'k'], function (p) {
    if (options[p]) {
      if (typeof options[p] === "string") {
        ret[p] = new BigInteger(options[p], 16);
      }
      else if (options[p] instanceof BigInteger) {
        ret[p] = options[p];
      }
      else {
        throw new Error("Invalid parameter: " + p);
      }
    }
  });

  if (options.hash) {
    ret.hash = function (x) {
      return options.hash(x).toLowerCase();
    };
  }

  if (!options.k && (options.N || options.g || options.hash)) {
    ret.k = ret.hash(ret.N.toString(16) + ret.g.toString(16));
  }

  return ret;
};

var random16byteHex = (function() {
  function random() {
    var wordCount = 4;
    var randomWords;

    // First we're going to try to use a built-in CSPRNG
    if (window.crypto && window.crypto.getRandomValues) {
        randomWords = new Int32Array(wordCount);
        window.crypto.getRandomValues(randomWords);
    }
    // Because of course IE calls it msCrypto instead of being standard
    else if (window.msCrypto && window.msCrypto.getRandomValues) {
        randomWords = new Int32Array(wordCount);
        window.msCrypto.getRandomValues(randomWords);
    }
    // Last resort - we'll use isaac.js to get a random number. It's seeded from Math.random(),
    // but we can run it for 100ms/0.1s to advance it a distance which will be dependent upon 
    // hardware and js engine. Also we will have the onkeyup skip a char worth of values. 
    else {
        randomWords = [];
        for (var i = 0; i < wordCount; i++) {
            randomWords.push(isaac.rand());
        }
    }
    
    var string = '';
    
    for( var i=0; i<wordCount; i++ ) {
      var int32 = randomWords[i];
      if( int32 < 0 ) int32 = -1 * int32;
      string = string + int32.toString(16);
    }

    return string;
  };
  
  	
  function isCrypto() {
    if (window.crypto && window.crypto.getRandomValues) {
      return true;
    }
    else if (window.msCrypto && window.msCrypto.getRandomValues) {
      return true;
    } else {
      return false;
    }
  };
  
  var crypto = isCrypto();
  
  function advance(ms) {
    if( !crypto ) {
      var start = Date.now();
      var end = start + ms;
      while( Date.now() < end ) {
          isaac.prng(64);
      }
    }
  }
  
  return {
    'random' : random,
    'isCrypto' : crypto,
    'advance' : advance 
  };
})();

// if it is isaac spend 0.1s advancing the stream
random16byteHex.advance(100);

var randInt = function () {
  return new BigInteger(random16byteHex.random(), 16);
};

