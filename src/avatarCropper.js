// Avatar crop modal: lets the user drag/zoom to choose which part of their
// photo shows inside the circular avatar, instead of an automatic center
// crop deciding for them. Pure UI — the confirmed square Blob is handed back
// to public/main.js (window.onAvatarCropped), which does the actual
// mvCommunity.uploadAvatar()/upsertMyMemberProfile() save, unchanged.
import Cropper from 'cropperjs';

const OUTPUT_SIZE = 400; // px, square — matches what mvAvatarHtml renders at up to

let cropper = null;
let objectUrl = null;

function els(){
  return {
    modal: document.getElementById('avatarCropModal'),
    img: document.getElementById('avatarCropImage'),
    preview: document.getElementById('avatarCropPreview'),
  };
}

async function updatePreview(){
  const { preview } = els();
  const selection = cropper?.getCropperSelection();
  if(!selection || !preview) return;
  try{
    const canvas = await selection.$toCanvas({ width: 112, height: 112 });
    preview.innerHTML = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    preview.appendChild(canvas);
  }catch(e){ /* selection not ready yet (e.g. mid-drag) — skip this frame */ }
}

function openAvatarCropper(file){
  const { modal, img } = els();
  if(!modal || !img) return;
  closeAvatarCropper(); // clear any previous instance first
  objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    const container = document.getElementById('avatarCropContainer');
    cropper = new Cropper(img, { container });
    // Cropper.js v2's <cropper-canvas> defaults to a 100px-tall box instead of
    // filling its container — pin it to the container's actual square size,
    // or the tool renders squashed with empty space below it.
    const canvasEl = cropper.getCropperCanvas();
    if(canvasEl){
      canvasEl.style.width = container.clientWidth + 'px';
      canvasEl.style.height = container.clientHeight + 'px';
    }
    const selection = cropper.getCropperSelection();
    if(selection){
      selection.aspectRatio = 1;
      selection.initialCoverage = 0.85;
      selection.addEventListener('change', updatePreview);
    }
    setTimeout(updatePreview, 80); // after the initial selection settles
  };
  img.src = objectUrl;
  modal.classList.add('active');
}

function closeAvatarCropper(){
  const { modal, img, preview } = els();
  if(cropper){ cropper.destroy(); cropper = null; }
  if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if(img) img.src = '';
  if(preview) preview.innerHTML = '';
  if(modal) modal.classList.remove('active');
}

async function confirmAvatarCrop(){
  const selection = cropper?.getCropperSelection();
  if(!selection) return;
  const canvas = await selection.$toCanvas({ width: OUTPUT_SIZE, height: OUTPUT_SIZE });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  closeAvatarCropper();
  if(blob) window.onAvatarCropped?.(blob);
}

window.openAvatarCropper = openAvatarCropper;
window.cancelAvatarCrop = closeAvatarCropper;
window.confirmAvatarCrop = confirmAvatarCrop;
