import serverless from 'serverless-http'
import { app } from '../../server/index.js'

const serverlessHandler = serverless(app)

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false
  return serverlessHandler(event, context)
}
