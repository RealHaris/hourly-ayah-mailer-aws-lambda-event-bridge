'use strict';

function buildBody(statusCode, message, data) {
  const body = {
    message: typeof message === 'string' ? message : '',
    status: String(statusCode)
  };
  if (data !== undefined) {
    body.data = data;
  }
  return body;
}

function respond(statusCode, message, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*'
    },
    body: JSON.stringify(buildBody(statusCode, message, data))
  };
}

module.exports = {
  respond,
  ok(message = 'OK', data) {
    return respond(200, message, data);
  },
  created(message = 'Created', data) {
    return respond(201, message, data);
  },
  badRequest(message = 'Bad Request', data) {
    return respond(400, message, data);
  },
  unauthorized(message = 'Unauthorized', data) {
    return respond(401, message, data);
  },
  forbidden(message = 'Forbidden', data) {
    return respond(403, message, data);
  },
  notFound(message = 'Not Found', data) {
    return respond(404, message, data);
  },
  conflict(message = 'Conflict', data) {
    return respond(409, message, data);
  },
  error(message = 'Internal Server Error', data) {
    return respond(500, message, data);
  }
};


