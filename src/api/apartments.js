import data from '../data/apartments.json';

export function getApartments() {
  return data;
}

export function getApartmentById(id) {
  return data.find(a => a.id === Number(id)) || null;
}
