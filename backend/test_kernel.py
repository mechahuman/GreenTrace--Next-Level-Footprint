"""
Test jupyter_client messaging directly.
"""
import jupyter_client
import time

km = jupyter_client.KernelManager(kernel_name="python3")
km.start_kernel()
kc = km.client()
kc.start_channels()
kc.wait_for_ready(timeout=30)
print("Kernel ready")

# Send a 1s sleep
msg_id = kc.execute("import time; time.sleep(1.0)")
print(f"Sent msg_id: {msg_id}")
t0 = time.monotonic()

for _ in range(20):
    try:
        msg = kc.get_iopub_msg(timeout=5.0)
        mtype = msg["msg_type"]
        pid = msg.get("parent_header", {}).get("msg_id", "")
        state = msg["content"].get("execution_state", "") if mtype == "status" else ""
        print(f"  msg_type={mtype}, parent_match={pid==msg_id}, state={state!r}")
        if pid == msg_id and mtype == "status" and state == "idle":
            print(f"  DONE after {time.monotonic()-t0:.3f}s")
            break
    except Exception as e:
        print(f"  Exception: {type(e).__name__}: {e}")
        break

km.shutdown_kernel(now=True)
print("Kernel shut down")
