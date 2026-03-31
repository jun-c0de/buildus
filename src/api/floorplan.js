export async function getFloorplanData(spaPath = '/spa_label.json', strPath = '/str_label.json') {
  const [str, spa] = await Promise.all([
    fetch(strPath).then(r => r.json()),
    fetch(spaPath).then(r => r.json()),
  ]);
  return { str, spa };
}

export async function getFloorplanIndex() {
  try {
    return await fetch('/floorplans_index.json').then(r => r.json());
  } catch {
    return null;
  }
}
