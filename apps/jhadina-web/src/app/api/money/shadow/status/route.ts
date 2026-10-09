/**
 * Public SHADOW read-only status alias.
 * The implementation remains on its original money/purse/status route for legacy clients
 * until a separate database and API migration is approved.
 * No financial authority is surfaced by either path.
 */
export {GET,dynamic,revalidate} from '../../purse/status/route'
