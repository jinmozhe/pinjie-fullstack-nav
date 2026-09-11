import { Alert, Flex, Modal } from "antd";
import { useRef, useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/api/http";

type Props = {
  children?: ReactNode;
  description: string;
  loading: boolean;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function StandardConfirmModal({ children, description, loading, open, title, onCancel, onConfirm }: Props) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const busy = loading || pending;
  const confirm = async () => {
    if (!open || loading || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailure(undefined);
    try {
      await onConfirm();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <Modal
      afterClose={() => setFailure(undefined)}
      cancelButtonProps={{ disabled: busy }}
      cancelText="取消"
      closable={!busy}
      confirmLoading={busy}
      keyboard={!busy}
      maskClosable={!busy}
      okButtonProps={{ danger: true }}
      okText="确定"
      open={open}
      aria-label={title}
      title={<span id="standard-confirm-title">{title}</span>}
      onCancel={() => { if (!loading && !submitting.current) onCancel(); }}
      onOk={() => void confirm()}
    >
      <Flex vertical gap={12}>
        <Alert showIcon type="warning" title="请确认操作范围" description={description} />
        {children}
        {failure && <Alert showIcon type="error" title="操作失败" description={failure} />}
        <p className="modal-copy">确认后将立即执行当前操作。</p>
      </Flex>
    </Modal>
  );
}
