export const getArn = (logicalId) => ({ 'Fn::GetAtt': [logicalId, 'Arn'] });

export async function queueName(resolveVariable, suffix) {
  const service = await resolveVariable('self:service');
  const stage = await resolveVariable('sls:stage');
  return `${service}-${stage}-${suffix}`;
}

export function queueWithDeadLetter(
  prefix,
  name,
  { visibilityTimeout = 60, maxReceiveCount = 5 } = {},
) {
  const deadLetterId = `${prefix}DeadLetterQueue`;
  return {
    [deadLetterId]: {
      Type: 'AWS::SQS::Queue',
      Properties: { QueueName: `${name}-dlq`, MessageRetentionPeriod: 1209600 },
    },
    [`${prefix}Queue`]: {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: name,
        VisibilityTimeout: visibilityTimeout,
        RedrivePolicy: { deadLetterTargetArn: getArn(deadLetterId), maxReceiveCount },
      },
    },
  };
}
