import { createClient } from '@supabase/supabase-js';

const root = document.getElementById('library-app');
const status = document.getElementById('library-status');
const publicList = document.getElementById('public-documents');
const privateList = document.getElementById('private-documents');
const privateLocked = document.getElementById('private-locked');
const loginForm = document.getElementById('library-login-form');
const account = document.getElementById('library-account');
const accountEmail = document.getElementById('library-account-email');
const uploadPanel = document.getElementById('library-upload-panel');
const uploadForm = document.getElementById('library-upload-form');
const uploadButton = document.getElementById('library-upload-button');
const allowedExtensions = new Set(['pdf', 'html', 'htm', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const maxBytes = 50 * 1024 * 1024;

function message(text, kind = '') {
  status.textContent = text;
  status.dataset.kind = kind;
}

function errorText(error) {
  return error?.message || '请求失败，请稍后重试。';
}

function fileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function emptyState(target, text) {
  target.replaceChildren();
  const note = document.createElement('div');
  note.className = 'library-note';
  note.textContent = text;
  target.append(note);
}

if (!root.dataset.supabaseUrl || !root.dataset.supabaseKey) {
  message('文档库尚未配置，请联系站点管理员。', 'error');
} else {
  const client = createClient(root.dataset.supabaseUrl, root.dataset.supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  let currentUser = null;
  let isOwner = false;
  let refreshNumber = 0;

  async function downloadPrivate(doc) {
    message(`正在下载 ${doc.file_name}…`);
    const { data, error } = await client.storage.from('library-private').download(doc.object_path);
    if (error) {
      message(`下载失败：${errorText(error)}`, 'error');
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    message('下载已开始。', 'success');
  }

  async function deleteDocument(doc) {
    if (!window.confirm(`删除“${doc.title}”？文件将无法恢复。`)) return;
    message('正在删除…');
    const bucket = doc.visibility === 'public' ? 'library-public' : 'library-private';
    const { error: fileError } = await client.storage.from(bucket).remove([doc.object_path]);
    if (fileError) {
      message(`删除失败：${errorText(fileError)}`, 'error');
      return;
    }
    const { error: rowError } = await client.from('library_documents').delete().eq('id', doc.id);
    if (rowError) {
      message(`文件已删除，但目录记录清理失败：${errorText(rowError)}`, 'error');
      return;
    }
    await refresh();
    message('文档已删除。', 'success');
  }

  function renderDocument(doc) {
    const item = document.createElement('article');
    item.className = 'library-item';

    const heading = document.createElement('h3');
    heading.textContent = doc.title;
    item.append(heading);

    const meta = document.createElement('div');
    meta.className = 'library-meta';
    meta.textContent = `${doc.file_name} · ${fileSize(doc.file_size)} · ${new Date(doc.created_at).toLocaleDateString('zh-CN')}`;
    item.append(meta);

    if (doc.description) {
      const description = document.createElement('p');
      description.textContent = doc.description;
      item.append(description);
    }

    const actions = document.createElement('div');
    actions.className = 'library-actions';
    if (doc.visibility === 'public') {
      const url = client.storage.from('library-public').getPublicUrl(doc.object_path, { download: doc.file_name });
      const link = document.createElement('a');
      link.href = url.data.publicUrl;
      link.textContent = '下载';
      link.setAttribute('download', doc.file_name);
      actions.append(link);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '下载';
      button.addEventListener('click', () => downloadPrivate(doc));
      actions.append(button);
    }

    if (isOwner) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '删除';
      remove.addEventListener('click', () => deleteDocument(doc));
      actions.append(remove);
    }
    item.append(actions);
    return item;
  }

  async function refresh() {
    const number = ++refreshNumber;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    const user = session?.user || null;
    let owner = false;
    if (user) {
      const { data, error } = await client.rpc('is_library_owner');
      if (error) throw error;
      owner = data === true;
    }
    if (number !== refreshNumber) return;
    currentUser = user;
    isOwner = owner;

    loginForm.hidden = !!currentUser;
    account.hidden = !currentUser;
    accountEmail.textContent = currentUser?.email || '';
    uploadPanel.hidden = !isOwner;
    privateLocked.hidden = isOwner;
    privateList.hidden = !isOwner;
    if (!isOwner) {
      privateLocked.textContent = currentUser
        ? '此账号尚未获得文档库主人权限。'
        : '登录后查看私有文档。';
      privateList.replaceChildren();
    }

    const { data: documents, error } = await client.from('library_documents')
      .select('id,title,description,visibility,file_name,file_size,object_path,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (number !== refreshNumber) return;
    const publicDocs = documents.filter((doc) => doc.visibility === 'public');
    const privateDocs = documents.filter((doc) => doc.visibility === 'private');
    publicList.replaceChildren(...publicDocs.map(renderDocument));
    if (publicDocs.length === 0) emptyState(publicList, '还没有公开文档。');
    if (isOwner) {
      privateList.replaceChildren(...privateDocs.map(renderDocument));
      if (privateDocs.length === 0) emptyState(privateList, '还没有私有文档。');
    }
    message('');
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = loginForm.elements.email.value.trim();
    message('正在发送登录链接…');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: new URL('library/', window.location.origin).href,
        shouldCreateUser: false,
      },
    });
    message(error ? `发送失败：${errorText(error)}` : '登录链接已发送，请查收邮件并点击链接。', error ? 'error' : 'success');
  });

  document.getElementById('library-signout').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) message(`退出失败：${errorText(error)}`, 'error');
    else await refresh().catch((reason) => message(errorText(reason), 'error'));
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isOwner || !currentUser) return;
    const file = uploadForm.elements.file.files?.[0];
    const extension = file?.name.split('.').pop()?.toLowerCase();
    if (!file || !allowedExtensions.has(extension)) {
      message('请选择支持的文档格式。', 'error');
      return;
    }
    if (file.size === 0 || file.size > maxBytes) {
      message('文件必须大于 0 且不超过 50 MB。', 'error');
      return;
    }
    if (file.name.length > 255) {
      message('文件名不能超过 255 个字符。', 'error');
      return;
    }

    const id = crypto.randomUUID();
    const path = `${currentUser.id}/${id}.${extension}`;
    const visibility = uploadForm.elements.visibility.value;
    const bucket = visibility === 'public' ? 'library-public' : 'library-private';
    const title = uploadForm.elements.title.value.trim();
    const description = uploadForm.elements.description.value.trim();
    if (!title) {
      message('请填写标题。', 'error');
      return;
    }

    uploadButton.disabled = true;
    message('正在上传…');
    try {
      const { error: uploadError } = await client.storage.from(bucket).upload(path, file, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: rowError } = await client.from('library_documents').insert({
        id, owner_id: currentUser.id, title, description, visibility,
        file_name: file.name, file_size: file.size, object_path: path,
      });
      if (rowError) {
        await client.storage.from(bucket).remove([path]);
        throw rowError;
      }
      uploadForm.reset();
      await refresh();
      message('上传成功。', 'success');
    } catch (error) {
      message(`上传失败：${errorText(error)}`, 'error');
    } finally {
      uploadButton.disabled = false;
    }
  });

  client.auth.onAuthStateChange(() => {
    setTimeout(() => refresh().catch((error) => message(`加载失败：${errorText(error)}`, 'error')), 0);
  });
  refresh().catch((error) => message(`加载失败：${errorText(error)}`, 'error'));
}
