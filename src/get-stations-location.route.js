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

    const countDuplicates = dirtyDuplicateCount(records);
    const respData = records.map(record => ({
      id: record.fields.stop_id,
      numberOfDuplicates: getMaxDuplicateValue(record, countDuplicates),
      name: record.fields.stop_name,
      description: record.fields.stop_desc,
      coordinates: {
        lat: record.fields.stop_lat,
        long: record.fields.stop_lon,
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

function dirtyDuplicateCount(records) {
  const coordinates = {};
  const descriptions = {};
  const names = {};

  records.forEach(record => {
    const coord = `${record.fields.stop_lat}-${record.fields.stop_lon}`;
    const name = record.fields.stop_name;
    const description = record.fields.stop_desc;

    coordinates[coord] = coordinates[coord] ? coordinates[coord] + 1 : 1;
    descriptions[description] = descriptions[description] ? descriptions[description] + 1 : 1;
    names[name] = names[name] ? names[name] + 1 : 1;

  });

  return {
    coordinates,
    descriptions,
    names,
  }
}

function getMaxDuplicateValue(record, ref) {
  const { coordinates, descriptions, names } = ref;

  return [
    coordinates[record.fields.stop_desc],
    descriptions[record.fields.stop_desc],
    names[record.fields.stop_name],
  ].reduce((max, v) => v > max ? v : max, 0);
}