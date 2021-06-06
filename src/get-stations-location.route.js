'use strict';

const axios = require('axios');
const Hoek = require('@hapi/hoek');
const Joi = require('joi');

const RATP_SEARCH_URL = 'https://data.ratp.fr/api/records/1.0/search/';

const routeParamsValidator = {
  params: Joi.object({
    name: Joi.string()
      .required()
      .description('station name'),
  }),
  query: Joi.object({
    limit: Joi.number()
      .description('Number of location returned'),
    offset: Joi.number()
      .description('offset of the first location returned'),
    order: Joi.string()
      .valid('id', 'name', 'lat', 'long', '-id', '-name', '-lat', '-long')
      .description('Order can be done on id, name, lat or long value. prefix with - to perform asceding sort.')
  }),
};

module.exports = {
  method: 'GET',
  path: '/stations/{name}',
  options: {
    tags: ['api'],
    description: 'Get station location informations',
    notes: 'Returns a list of stations location information from a station name',
    validate: routeParamsValidator,
  },
  handler: async function (request, h) {
    const stationName = Hoek.escapeHtml(request.params.name);
    const { limit, offset } = request.query;

    const { data, status } = await axios.get(RATP_SEARCH_URL, {
      params: {
        dataset: 'positions-geographiques-des-stations-du-reseau-ratp',
        q: stationName,
        ...(limit && { rows: limit }),
        ...(offset && { start: offset }),
      }
    });

    if (status !== 200) {
      return h.response("An error occured.").code(status);
    }

    const { parameters: { start, rows }, records } = data;

    const respData = records.map(o => ({
      id: o.fields.stop_id,
      name: o.fields.stop_name,
      description: o.fields.stop_desc,
      coordinates: {
        lat: o.fields.stop_lat,
        long: o.fields.stop_lon,
      }
    }));

    return h.response({
      limit: rows,
      offset: start,
      data: respData,
    })
      .header('range', `${start}-${start + data.records.length}/${data.nhits}`);
  }
}
