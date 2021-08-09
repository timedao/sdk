# TimeAtomSDK

## A word of caution
This SDK and corresponding smart contracts are currently in alpha, use at your own risks

## Methods
**checkIfExists**(*string* hashKey) returns (*bool*)
<br>Method used to check if a tuple exists for this hashkey.

**calculateFee**(*timestamp* endDate) returns (float)
 <br>*async*. Returns the cost to store a tuple until the timestamp "endDate" . Fees are expressed in USD.

**retrieve**(*string* hashKey)
  <br>*async*. Retrieve a tuple. If the tuple is still timelocked the call will return the opening date

 **getPublicContent**(*string* hashKey)  returns {*string* event, *timestamp* opening_date, *string* public_content }
  <br>*async*. Retrieve a tuple's public (non timelocked) content along with its opening date timestamp

 **store**(*string* name,*string* public_content, *string* timelocked_content,*timestamp* opening_date, *object* options = { gas: 1000000 }) returns {*array* logs, *timestamp* opening_date, *mixed* BoxReady,(...*bool* nameAlreadyExists)}
 <br>*async*. Store a tuple along with its opening date timestamp

 