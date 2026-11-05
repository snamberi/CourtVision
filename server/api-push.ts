import {handlePush} from './push';
import {supaEnv} from './supabase';
import {pushEnv} from './push';
export const GET=(request:Request)=>handlePush(request,supaEnv(),pushEnv(process.env));
export const POST=GET;
