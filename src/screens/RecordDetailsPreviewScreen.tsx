import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  Trash2,
  User,
  WalletCards,
  XCircle,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  MobileActionSheet,
  MobileButton,
  MobileCard,
  MobileChartCard,
  MobileDataList,
  MobileDetailHeader,
  MobileDocumentCard,
  MobileFileUpload,
  MobileInfoRow,
  MobilePageHeader,
  MobileProgressBar,
  MobileScreen,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileTimeline,
  MobileToast,
  MobileText,
} from '@/components/mobile';
import { memberDocuments, moneyMovements, recordTabs, recordTimeline } from '@/data/demo';
import { formatTzs } from '@/utils/format';

export default function RecordDetailsPreviewScreen() {
  const params = useLocalSearchParams<{ record?: string | string[] }>();
  const router = useRouter();
  const [selectedRecord, setSelectedRecord] = useState('member');
  const [actionsOpen, setActionsOpen] = useState(false);
  const requestedRecord = getRequestedRecord(params.record);
  const active = requestedRecord || selectedRecord;

  const changeRecord = (value: string) => {
    setSelectedRecord(value);
    router.setParams({ record: value });
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Record system"
        title="Detail previews"
        subtitle="Native review layouts for Nane records."
      />

      <MobileStatusTabs tabs={recordTabs} value={active} onChange={changeRecord} />

      {active === 'member' ? <MemberDetail onActions={() => setActionsOpen(true)} /> : null}
      {active === 'transaction' ? <TransactionDetail onActions={() => setActionsOpen(true)} /> : null}
      {active === 'loan' ? <LoanDetail onActions={() => setActionsOpen(true)} /> : null}
      {active === 'approval' ? <ApprovalDetail onActions={() => setActionsOpen(true)} /> : null}
      {active === 'event' ? <EventDetail onActions={() => setActionsOpen(true)} /> : null}
      {active === 'invoice' ? <InvoiceDetail onActions={() => setActionsOpen(true)} /> : null}

      <MobileActionSheet
        visible={actionsOpen}
        title="Record actions"
        description="Actions stay consistent across details and approvals."
        onClose={() => setActionsOpen(false)}
        actions={[
          { label: 'Share record', description: 'Send link or summary', icon: Share2, tone: 'info', onPress: () => undefined },
          { label: 'Download PDF', description: 'Save receipt or statement', icon: Download, tone: 'primary', onPress: () => undefined },
          { label: 'Delete record', description: 'Only for wrongly captured records', icon: Trash2, destructive: true, onPress: () => undefined },
        ]}
      />
    </MobileScreen>
  );
}

function getRequestedRecord(record?: string | string[]) {
  const value = Array.isArray(record) ? record[0] : record;
  return recordTabs.some((tab) => tab.value === value) ? value : undefined;
}

function MemberDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Member profile"
        title="Upendo Fatukubonye"
        subtitle="MBR-0032 · Tegemeo Group"
        status="Active"
        avatarName="Upendo Fatukubonye"
        avatarTone="paid"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel
        title="Net shares"
        value={formatTzs(850000)}
        description="Brought forward + current year - used shares"
        tone="teal"
        icon={WalletCards}
        footer={<MobileProgressBar value={82} label="Current financial year shares" tone="green" />}
      />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Member information
        </MobileText>
        <MobileInfoRow label="Phone" value="+255 712 345 678" icon={Phone} />
        <MobileInfoRow label="Email" value="upendo@nane.co.tz" icon={Mail} />
        <MobileInfoRow label="Package" value="Weekly shares" helper="TZS 20,000 every Friday" icon={ShieldCheck} status="Active" />
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Documents
        </MobileText>
        <View style={styles.stack}>
          {memberDocuments.map((document) => (
            <MobileDocumentCard key={document.title} {...document} onView={() => undefined} onDownload={() => undefined} />
          ))}
        </View>
      </MobileCard>

      <MobileChartCard title="Share activity" description="Last six months contribution pattern." values={[30, 42, 38, 58, 62, 80]} tone="teal" />
    </>
  );
}

function TransactionDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Transaction detail"
        title="Weekly shares payment"
        subtitle="Reference 9912 · Today 09:16"
        status="Paid"
        avatarName="Upendo Fatukubonye"
        avatarTone="paid"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel title="Amount paid" value={formatTzs(20000)} description="Mobile money payment confirmed" tone="green" icon={Banknote} />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Payment details
        </MobileText>
        <MobileInfoRow label="Member" value="Upendo Fatukubonye" icon={User} />
        <MobileInfoRow label="Type" value="Shares contribution" icon={WalletCards} />
        <MobileInfoRow label="Channel" value="Mobile Money · M-Pesa" icon={CreditCard} status="Delivered" />
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Timeline
        </MobileText>
        <MobileTimeline items={recordTimeline} />
      </MobileCard>
    </>
  );
}

function LoanDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Loan detail"
        title="Business loan"
        subtitle="LN-2026-0091 · 8 months remaining"
        status="Active"
        avatarName="Issa Mdoe"
        avatarTone="warning"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel
        title="Outstanding balance"
        value={formatTzs(480000)}
        description="Next installment due 12 July 2026"
        tone="orange"
        icon={Landmark}
        footer={<MobileProgressBar value={64} label="Repayment progress" tone="orange" />}
      />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Loan terms
        </MobileText>
        <MobileInfoRow label="Principal" value={formatTzs(1200000)} icon={Banknote} />
        <MobileInfoRow label="Installment" value={formatTzs(80000)} helper="Monthly repayment" icon={CalendarDays} />
        <MobileInfoRow label="Guarantors" value="2 guarantors attached" icon={ShieldCheck} status="Approved" />
      </MobileCard>

      <MobileDataList items={moneyMovements.slice(0, 2)} />
    </>
  );
}

function ApprovalDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Approval inbox"
        title="Withdrawal request"
        subtitle="Amina Joseph · Requires treasurer approval"
        status="Under Review"
        avatarName="Amina Joseph"
        avatarTone="review"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel title="Requested amount" value={formatTzs(350000)} description="Transfer to CRDB bank account" tone="purple" icon={WalletCards} />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Approval decision
        </MobileText>
        <View style={styles.actionRow}>
          <MobileButton label="Approve" icon={CheckCircle2} style={styles.actionButton} />
          <MobileButton label="Reject" icon={XCircle} variant="danger" style={styles.actionButton} />
        </View>
        <MobileToast
          title="PIN confirmation required"
          description="Final approval should request the officer PIN."
          tone="info"
          style={styles.feedback}
        />
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Request checks
        </MobileText>
        <MobileInfoRow label="Wallet balance" value={formatTzs(12450000)} icon={WalletCards} status="Available" />
        <MobileInfoRow label="Bank account" value="CRDB · 0150 **** 880" icon={Landmark} status="Verified" />
      </MobileCard>
    </>
  );
}

function EventDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Event detail"
        title="Annual General Meeting"
        subtitle="Public registration enabled"
        status="Published"
        avatarName="Annual General Meeting"
        avatarTone="info"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel title="Registrations" value="128" description="76 members · 52 non-members" tone="blue" icon={CalendarDays} />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Event information
        </MobileText>
        <MobileInfoRow label="Date" value="10 July 2026 · 09:00" icon={CalendarDays} />
        <MobileInfoRow label="Venue" value="Dodoma Conference Hall" icon={MapPin} />
        <MobileInfoRow label="Fee" value={`${formatTzs(15000)} member · ${formatTzs(25000)} non-member`} icon={CreditCard} status="Paid" />
      </MobileCard>

      <MobileFileUpload title="Upload attendance sheet" description="Attach scanned attendance or event documents." />
    </>
  );
}

function InvoiceDetail({ onActions }: { onActions: () => void }) {
  return (
    <>
      <MobileDetailHeader
        eyebrow="Invoice detail"
        title="Subscription invoice"
        subtitle="INV-2026-0042 · Due 12 July 2026"
        status="Unpaid"
        avatarName="Upendo Fatukubonye"
        avatarTone="warning"
        onActionsPress={onActions}
      />

      <MobileSummaryPanel title="Invoice amount" value={formatTzs(60000)} description="Package subscription and SMS fees" tone="red" icon={FileText} />

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Invoice lines
        </MobileText>
        <MobileInfoRow label="Weekly shares package" value={formatTzs(40000)} icon={WalletCards} />
        <MobileInfoRow label="SMS notifications" value={formatTzs(20000)} icon={FileText} />
        <MobileInfoRow label="Payment status" value="Awaiting mobile money payment" icon={CreditCard} status="Pending" />
      </MobileCard>

      <View style={styles.actionRow}>
        <MobileButton label="Pay now" icon={CreditCard} style={styles.actionButton} />
        <MobileButton label="Download" icon={Download} variant="secondary" style={styles.actionButton} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: 14,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  feedback: {
    marginTop: 14,
  },
});
