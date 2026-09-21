import { WORK_CATALOG, WORK_STATUSES } from '../data/works';

const ids = (...values) => values.flat();

const rules = {
  bathroom: [
    ['plumbing', WORK_STATUSES.TO_CHECK],
    ['sanitary', WORK_STATUSES.RECOMMENDED],
    ['waterproofing', WORK_STATUSES.TO_CHECK],
    ['tiling', WORK_STATUSES.RECOMMENDED],
    ['electricity', WORK_STATUSES.TO_CHECK],
    ['lighting', WORK_STATUSES.RECOMMENDED],
    ['ventilation', WORK_STATUSES.TO_CHECK],
    ['painting', WORK_STATUSES.RECOMMENDED],
  ],
  kitchen: [
    ['kitchen', WORK_STATUSES.CONFIRMED],
    ['plumbing', WORK_STATUSES.TO_CHECK],
    ['electricity', WORK_STATUSES.TO_CHECK],
    ['lighting', WORK_STATUSES.RECOMMENDED],
    ['flooring', WORK_STATUSES.RECOMMENDED],
    ['painting', WORK_STATUSES.RECOMMENDED],
  ],
  'full-renovation': [
    ['protection', WORK_STATUSES.RECOMMENDED],
    ['removal', WORK_STATUSES.TO_CHECK],
    ['waste-removal', WORK_STATUSES.RECOMMENDED],
    ['electricity', WORK_STATUSES.TO_CHECK],
    ['plumbing', WORK_STATUSES.TO_CHECK],
    ['insulation', WORK_STATUSES.TO_CHECK],
    ['painting', WORK_STATUSES.RECOMMENDED],
    ['flooring', WORK_STATUSES.RECOMMENDED],
  ],
  performance: [
    ['insulation', WORK_STATUSES.TO_CHECK],
    ['windows', WORK_STATUSES.TO_CHECK],
    ['heating', WORK_STATUSES.TO_CHECK],
    ['ventilation', WORK_STATUSES.TO_CHECK],
  ],
};

export function suggestWorks({ projectType, roomIds = [], objectives = [] } = {}) {
  const pairs = [];
  const add = (id, status) => {
    if (!pairs.some(([existing]) => existing === id)) pairs.push([id, status]);
  };

  (rules[projectType] || []).forEach(([id, status]) => add(id, status));

  if (roomIds.includes('bathroom')) rules.bathroom.forEach(([id, status]) => add(id, status));
  if (roomIds.includes('kitchen')) rules.kitchen.forEach(([id, status]) => add(id, status));
  if (objectives.includes('comfort')) add('ventilation', WORK_STATUSES.TO_CHECK);
  if (objectives.includes('energy')) add('insulation', WORK_STATUSES.TO_CHECK);

  return pairs.map(([id, status]) => ({
    ...WORK_CATALOG.find((work) => work.id === id),
    status,
  })).filter((work) => work.id);
}

export function getMissingInformation(project = {}) {
  const missing = [];
  if (!project.projectType) missing.push({ id: 'project-type', label: 'Type de projet à préciser' });
  if (!project.propertyType) missing.push({ id: 'property-type', label: 'Type de bien à préciser' });
  if (!project.location?.city && !project.location?.unknown) missing.push({ id: 'location', label: 'Ville ou localisation à préciser' });
  if (!project.roomIds?.length) missing.push({ id: 'rooms', label: 'Pièces concernées à préciser' });
  if (!project.objectives?.length) missing.push({ id: 'objectives', label: 'Objectifs à préciser' });
  return missing;
}