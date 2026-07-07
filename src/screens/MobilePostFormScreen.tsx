import { router, useLocalSearchParams } from 'expo-router';
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Mail,
  MapPin,
  Send,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileErrorState,
  MobileFormSection,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createAssociationPost,
  getAssociationPost,
  updateAssociationPost,
  type CommunityPost,
  type CommunityPostPayload,
  type CommunityPostStatus,
  type CommunityPostType,
} from '@/services/post-service';
import { getApiErrorMessage } from '@/types/api';

type PostFormState = {
  id?: string;
  postType: 'JOB' | 'TENDER';
  title: string;
  departmentUnit: string;
  locationRegion: string;
  deadlineDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  description: string;
  employmentType: string;
  positionsCount: string;
  requiredQualifications: string;
  experienceYears: string;
  skillsCompetencies: string;
  applicationEmail: string;
  applicationLink: string;
  jobDescriptionPath: string;
  tenderReferenceNumber: string;
  tenderCategory: string;
  eligibilityCriteria: string;
  documentCollectionLink: string;
  submissionInstructions: string;
  openingDateTime: string;
  contactPersonEmail: string;
  tenderDocumentPath: string;
};

type MobilePostFormScreenProps = {
  forcedPostType?: CommunityPostType;
};

const emptyForm = (postType: 'JOB' | 'TENDER' = 'JOB'): PostFormState => ({
  postType,
  title: '',
  departmentUnit: '',
  locationRegion: '',
  deadlineDate: '',
  status: 'DRAFT',
  description: '',
  employmentType: '',
  positionsCount: '',
  requiredQualifications: '',
  experienceYears: '',
  skillsCompetencies: '',
  applicationEmail: '',
  applicationLink: '',
  jobDescriptionPath: '',
  tenderReferenceNumber: '',
  tenderCategory: '',
  eligibilityCriteria: '',
  documentCollectionLink: '',
  submissionInstructions: '',
  openingDateTime: '',
  contactPersonEmail: '',
  tenderDocumentPath: '',
});

const postTypeOptions = [
  { value: 'JOB', label: 'Job' },
  { value: 'TENDER', label: 'Tender' },
];

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
];

const employmentOptions = [
  { value: '', label: 'Not specified' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
  { value: 'OTHER', label: 'Other' },
];

export default function MobilePostFormScreen({ forcedPostType }: MobilePostFormScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const requestedPostType = normalizePostType((Array.isArray(params.postType) ? params.postType[0] : params.postType) || forcedPostType);
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const [form, setForm] = useState<PostFormState>(() => emptyForm(requestedPostType));
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [targetStatus, setTargetStatus] = useState<CommunityPostStatus | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isJobScope = normalizePostType(forcedPostType) === 'JOB';
  const canManagePosts = useMemo(() => hasPostManagePermission(user), [user]);
  const isEdit = Boolean(postId);

  const loadPost = useCallback(async () => {
    if (!associationId || !postId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const post = await getAssociationPost(associationId, postId);
      setForm(formFromPost(post, requestedPostType));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [associationId, postId, requestedPostType]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadPost();
    });
    return () => {
      active = false;
    };
  }, [loadPost]);

  const updateField = <K extends keyof PostFormState>(field: K, value: PostFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goToManage = (savedPost?: CommunityPost) => {
    const path = isJobScope ? '/associations/jobs/manage' : '/associations/posts/manage';
    const route = getRouteByPath(path);
    if (!route) {
      router.back();
      return;
    }
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: route.id,
        postId: savedPost?.id,
      },
    } as never);
  };

  const savePost = async (status: CommunityPostStatus) => {
    if (!associationId || !canManagePosts) return;
    const nextErrors = validateForm(form);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please correct the highlighted fields before saving this post.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = buildPayload(form, status);
      const saved = isEdit && postId
        ? await updateAssociationPost(associationId, postId, payload)
        : await createAssociationPost(associationId, payload);
      setNotice(`${postTypeLabel(saved.postType)} saved successfully.`);
      goToManage(saved);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
      setTargetStatus(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Community posts are available from the association admin workspace." />;
  }

  if (!canManagePosts) {
    return <AccessDeniedScreen title="Permission required" description="You need community post management permission to create or edit this record." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading post details" />;
  }

  const pageTitle = isEdit ? `Edit ${postTypeLabel(form.postType)}` : isJobScope ? 'New Job' : 'New Post';
  const actionLabel = form.status === 'CLOSED' ? 'Save Closed' : form.postType === 'JOB' ? 'Publish Job' : 'Publish Post';

  return (
    <MobileScreen>
      <MobilePageHeader
        title={pageTitle}
        eyebrow="Community"
        subtitle={form.postType === 'JOB' ? 'Capture job opportunity details.' : 'Capture tender or opportunity details.'}
        onBack={() => goToManage()}
      />

      {error ? <MobileErrorState title="Post form issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <View style={styles.noticeRow}>
            <CheckCircle2 size={18} color="#15803D" />
            <MobileText variant="small" weight="bold" style={styles.noticeText}>
              {notice}
            </MobileText>
          </View>
        </MobileCard>
      ) : null}

      <MobileCard compact accent={form.status === 'ACTIVE' ? 'green' : form.status === 'CLOSED' ? 'slate' : 'orange'}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <MobileText variant="section" weight="bold">
              {form.title || (form.postType === 'JOB' ? 'Unnamed job' : 'Unnamed tender')}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {[form.departmentUnit || 'No department', form.locationRegion || 'No location'].join(' · ')}
            </MobileText>
          </View>
          <MobileStatusBadge status={form.status} />
        </View>
      </MobileCard>

      <MobileFormSection title="Basic Details" description="Core information shown to members.">
        {isJobScope ? (
          <MobileCard compact accent="blue">
            <View style={styles.lockedType}>
              <BriefcaseBusiness size={20} color="#2563EB" />
              <View style={styles.summaryCopy}>
                <MobileText variant="body" weight="bold">
                  Job post
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  This route creates job opportunities only.
                </MobileText>
              </View>
            </View>
          </MobileCard>
        ) : (
          <MobileSelect
            label="Post Type"
            value={form.postType}
            options={postTypeOptions}
            onChange={(value) => updateField('postType', normalizePostType(value))}
          />
        )}
        <MobileTextInput
          label={form.postType === 'JOB' ? 'Title / Position Name *' : 'Title / Tender Name *'}
          value={form.title}
          onChangeText={(value) => updateField('title', value)}
          placeholder={form.postType === 'JOB' ? 'Senior Accountant' : 'Supply of office equipment'}
          error={validationErrors.title}
          icon={FileText}
        />
        <MobileTextInput
          label="Department / Unit"
          value={form.departmentUnit}
          onChangeText={(value) => updateField('departmentUnit', value)}
          placeholder="Finance"
          icon={BriefcaseBusiness}
        />
        <MobileTextInput
          label="Location / Region"
          value={form.locationRegion}
          onChangeText={(value) => updateField('locationRegion', value)}
          placeholder="Dar es Salaam"
          icon={MapPin}
        />
        <MobileTextInput
          label="Deadline"
          value={form.deadlineDate}
          onChangeText={(value) => updateField('deadlineDate', value)}
          placeholder="2026-07-31T17:00"
          helperText="Use YYYY-MM-DD or YYYY-MM-DDTHH:mm."
          error={validationErrors.deadlineDate}
          icon={CalendarClock}
        />
        <MobileSelect
          label="Status"
          value={form.status}
          options={statusOptions}
          onChange={(value) => updateField('status', value as PostFormState['status'])}
        />
        <MobileTextInput
          label="Description / Details"
          value={form.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder={form.postType === 'JOB' ? 'Summarize the opportunity and expectations.' : 'Summarize scope, requirements, and submission expectations.'}
          multiline
          numberOfLines={4}
          icon={FileText}
        />
      </MobileFormSection>

      {form.postType === 'JOB' ? (
        <MobileFormSection title="Job Details" description="Employment terms, requirements, and application contacts.">
          <MobileSelect
            label="Employment Type"
            value={form.employmentType}
            options={employmentOptions}
            onChange={(value) => updateField('employmentType', value)}
          />
          <MobileTextInput
            label="No. of Positions"
            value={form.positionsCount}
            onChangeText={(value) => updateField('positionsCount', value)}
            placeholder="1"
            keyboardType="number-pad"
            error={validationErrors.positionsCount}
          />
          <MobileTextInput
            label="Experience Years"
            value={form.experienceYears}
            onChangeText={(value) => updateField('experienceYears', value)}
            placeholder="3"
            keyboardType="number-pad"
            error={validationErrors.experienceYears}
          />
          <MobileTextInput
            label="Required Qualifications"
            value={form.requiredQualifications}
            onChangeText={(value) => updateField('requiredQualifications', value)}
            placeholder="CPA, degree, professional certification..."
            multiline
            numberOfLines={3}
          />
          <MobileTextInput
            label="Skills / Competencies"
            value={form.skillsCompetencies}
            onChangeText={(value) => updateField('skillsCompetencies', value)}
            placeholder="Reporting, Excel, leadership..."
            multiline
            numberOfLines={3}
          />
          <MobileTextInput
            label="Application Email"
            value={form.applicationEmail}
            onChangeText={(value) => updateField('applicationEmail', value)}
            placeholder="hr@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={validationErrors.applicationEmail}
            icon={Mail}
          />
          <MobileTextInput
            label="Application Link"
            value={form.applicationLink}
            onChangeText={(value) => updateField('applicationLink', value)}
            placeholder="https://..."
            autoCapitalize="none"
            error={validationErrors.applicationLink}
            icon={LinkIcon}
          />
        </MobileFormSection>
      ) : (
        <MobileFormSection title="Tender Details" description="Reference, eligibility, and submission details.">
          <MobileTextInput label="Tender Reference Number" value={form.tenderReferenceNumber} onChangeText={(value) => updateField('tenderReferenceNumber', value)} placeholder="TND-2026-001" />
          <MobileTextInput label="Category / Sector" value={form.tenderCategory} onChangeText={(value) => updateField('tenderCategory', value)} placeholder="Supplies" />
          <MobileTextInput label="Opening Date & Time" value={form.openingDateTime} onChangeText={(value) => updateField('openingDateTime', value)} placeholder="2026-07-31T10:00" error={validationErrors.openingDateTime} />
          <MobileTextInput label="Contact Person / Email" value={form.contactPersonEmail} onChangeText={(value) => updateField('contactPersonEmail', value)} placeholder="procurement@example.com" keyboardType="email-address" autoCapitalize="none" error={validationErrors.contactPersonEmail} />
          <MobileTextInput label="Eligibility Criteria" value={form.eligibilityCriteria} onChangeText={(value) => updateField('eligibilityCriteria', value)} placeholder="Required registration, licenses..." multiline numberOfLines={3} />
          <MobileTextInput label="Submission Instructions" value={form.submissionInstructions} onChangeText={(value) => updateField('submissionInstructions', value)} placeholder="Where and how bidders should submit." multiline numberOfLines={3} />
          <MobileTextInput label="Document Collection Link" value={form.documentCollectionLink} onChangeText={(value) => updateField('documentCollectionLink', value)} placeholder="https://..." autoCapitalize="none" error={validationErrors.documentCollectionLink} />
        </MobileFormSection>
      )}

      <View style={styles.actions}>
        <MobileButton label="Cancel" variant="secondary" onPress={() => goToManage()} disabled={saving} />
        <MobileButton label={saving ? 'Saving...' : 'Save Draft'} icon={CheckCircle2} variant="secondary" onPress={() => void savePost('DRAFT')} loading={saving && targetStatus === 'DRAFT'} disabled={saving} />
        <MobileButton
          label={saving ? 'Saving...' : actionLabel}
          icon={Send}
          onPress={() => {
            const nextStatus = form.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE';
            if (nextStatus === 'ACTIVE') setTargetStatus('ACTIVE');
            else void savePost(nextStatus);
          }}
          loading={saving && targetStatus === 'ACTIVE'}
          disabled={saving}
        />
      </View>

      <MobileConfirmSheet
        visible={targetStatus === 'ACTIVE' && !saving}
        title={form.postType === 'JOB' ? 'Publish job' : 'Publish post'}
        description={`Publish "${form.title || 'this post'}" and notify eligible members according to notification settings?`}
        confirmLabel="Publish"
        onCancel={() => setTargetStatus(null)}
        onConfirm={() => void savePost('ACTIVE')}
      />
    </MobileScreen>
  );
}

function formFromPost(post: CommunityPost, fallbackType: 'JOB' | 'TENDER'): PostFormState {
  return {
    ...emptyForm(normalizePostType(post.postType || fallbackType)),
    id: post.id,
    postType: normalizePostType(post.postType || fallbackType),
    title: post.title || '',
    departmentUnit: post.departmentUnit || '',
    locationRegion: post.locationRegion || '',
    deadlineDate: fromApiDateTime(post.deadlineDate),
    status: normalizePostStatus(post.status),
    description: post.description || '',
    employmentType: post.employmentType || '',
    positionsCount: post.positionsCount?.toString() || '',
    requiredQualifications: post.requiredQualifications || '',
    experienceYears: post.experienceYears?.toString() || '',
    skillsCompetencies: post.skillsCompetencies || '',
    applicationEmail: post.applicationEmail || '',
    applicationLink: post.applicationLink || '',
    jobDescriptionPath: post.jobDescriptionPath || '',
    tenderReferenceNumber: post.tenderReferenceNumber || '',
    tenderCategory: post.tenderCategory || '',
    eligibilityCriteria: post.eligibilityCriteria || '',
    documentCollectionLink: post.documentCollectionLink || '',
    submissionInstructions: post.submissionInstructions || '',
    openingDateTime: fromApiDateTime(post.openingDateTime),
    contactPersonEmail: post.contactPersonEmail || '',
    tenderDocumentPath: post.tenderDocumentPath || '',
  };
}

function validateForm(form: PostFormState) {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = 'Title is required.';
  if (form.positionsCount.trim() && !isPositiveInteger(form.positionsCount)) errors.positionsCount = 'Use a whole number.';
  if (form.experienceYears.trim() && !isPositiveInteger(form.experienceYears, true)) errors.experienceYears = 'Use 0 or a whole number.';
  if (form.applicationEmail.trim() && !isEmail(form.applicationEmail)) errors.applicationEmail = 'Use a valid email address.';
  if (form.contactPersonEmail.trim() && !isEmail(form.contactPersonEmail)) errors.contactPersonEmail = 'Use a valid email address.';
  if (form.applicationLink.trim() && !isUrl(form.applicationLink)) errors.applicationLink = 'Use a valid URL.';
  if (form.documentCollectionLink.trim() && !isUrl(form.documentCollectionLink)) errors.documentCollectionLink = 'Use a valid URL.';
  if (form.deadlineDate.trim() && !toLocalDateTime(form.deadlineDate)) errors.deadlineDate = 'Use YYYY-MM-DD or YYYY-MM-DDTHH:mm.';
  if (form.openingDateTime.trim() && !toLocalDateTime(form.openingDateTime)) errors.openingDateTime = 'Use YYYY-MM-DD or YYYY-MM-DDTHH:mm.';
  return errors;
}

function buildPayload(form: PostFormState, status: CommunityPostStatus): CommunityPostPayload {
  const postType = form.postType;
  return {
    postType,
    title: form.title.trim(),
    departmentUnit: textOrNull(form.departmentUnit),
    locationRegion: textOrNull(form.locationRegion),
    deadlineDate: toLocalDateTime(form.deadlineDate),
    status,
    description: textOrNull(form.description),
    employmentType: postType === 'JOB' ? textOrNull(form.employmentType) : null,
    positionsCount: postType === 'JOB' ? intOrNull(form.positionsCount) : null,
    requiredQualifications: postType === 'JOB' ? textOrNull(form.requiredQualifications) : null,
    experienceYears: postType === 'JOB' ? intOrNull(form.experienceYears) : null,
    skillsCompetencies: postType === 'JOB' ? textOrNull(form.skillsCompetencies) : null,
    applicationEmail: postType === 'JOB' ? textOrNull(form.applicationEmail) : null,
    applicationLink: postType === 'JOB' ? textOrNull(form.applicationLink) : null,
    jobDescriptionPath: postType === 'JOB' ? textOrNull(form.jobDescriptionPath) : null,
    tenderReferenceNumber: postType === 'TENDER' ? textOrNull(form.tenderReferenceNumber) : null,
    tenderCategory: postType === 'TENDER' ? textOrNull(form.tenderCategory) : null,
    eligibilityCriteria: postType === 'TENDER' ? textOrNull(form.eligibilityCriteria) : null,
    documentCollectionLink: postType === 'TENDER' ? textOrNull(form.documentCollectionLink) : null,
    submissionInstructions: postType === 'TENDER' ? textOrNull(form.submissionInstructions) : null,
    openingDateTime: postType === 'TENDER' ? toLocalDateTime(form.openingDateTime) : null,
    contactPersonEmail: postType === 'TENDER' ? textOrNull(form.contactPersonEmail) : null,
    tenderDocumentPath: postType === 'TENDER' ? textOrNull(form.tenderDocumentPath) : null,
  };
}

function normalizePostType(value?: string | null): 'JOB' | 'TENDER' {
  return String(value || '').toUpperCase() === 'TENDER' ? 'TENDER' : 'JOB';
}

function normalizePostStatus(value?: string | null): 'DRAFT' | 'ACTIVE' | 'CLOSED' {
  const status = String(value || '').toUpperCase();
  if (status === 'ACTIVE' || status === 'CLOSED') return status;
  return 'DRAFT';
}

function postTypeLabel(type?: string | null) {
  return normalizePostType(type) === 'JOB' ? 'Job' : 'Tender';
}

function fromApiDateTime(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 16);
}

function toLocalDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T23:59:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function intOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number.parseInt(trimmed, 10) : null;
}

function isPositiveInteger(value: string, allowZero = false) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && (allowZero ? numberValue >= 0 : numberValue > 0);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasPostManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    ['community.manage', 'posts_manage', 'association_admin', 'admin'].includes(value),
  );
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  lockedType: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
