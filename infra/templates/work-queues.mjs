// Usage: custom.workQueues: { PurchaseJobs: { visibilityTimeout: 90 } } creates PurchaseJobsQueue + DLQ.
import { queueName, queueWithDeadLetter } from './lib/queue.mjs';

const kebabCase = (value) => value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

export default async ({ resolveVariable }) => {
  const queues = await resolveVariable('self:custom.workQueues');
  const resources = {};
  for (const [prefix, options] of Object.entries(queues)) {
    const name = await queueName(resolveVariable, kebabCase(prefix));
    Object.assign(resources, queueWithDeadLetter(prefix, name, options));
  }
  return { Resources: resources };
};
