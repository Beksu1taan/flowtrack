import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMe, updateMe } from "../services/api";

function ConsentGate() {
  const [needed, setNeeded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe().then((me) => setNeeded(Boolean(me.needsConsent))).catch(() => {});
  }, []);

  if (!needed) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await updateMe({ consent: true });
      setNeeded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back">
      <div className="modal box">
        <h2>Обновление политики конфиденциальности</h2>
        <p className="muted">
          Чтобы продолжить пользоваться FlowTrack, подтверди согласие на обработку персональных данных.
        </p>
        <label className="consent">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            Я согласен(на) с <Link to="/privacy" target="_blank">Политикой конфиденциальности</Link>
          </span>
        </label>
        <button disabled={!checked || busy} onClick={accept}>Продолжить</button>
      </div>
    </div>
  );
}

export default ConsentGate;
