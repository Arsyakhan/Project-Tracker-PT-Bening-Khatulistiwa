import { OPNAME_STATUS } from '../../lib/gudang';
import StatusDot from './StatusDot';

// Status sesi stock opname.
export default function OpnameStatus({ status }) {
  return <StatusDot status={OPNAME_STATUS[status] || { label: status, tone: 'amber' }} />;
}
