use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct MessageHeader {
    pub channel_id: u16,
    pub sequence: u32,
    pub log_time: u64,
    pub publish_time: u64,
}

#[wasm_bindgen]
pub struct RawMessage {
    pub header: MessageHeader,
    #[wasm_bindgen(getter_with_clone)]
    pub data: js_sys::Uint8Array,
}

static mut BUFFER: Vec<u8> = vec![];
static mut STREAM: Option<Box<dyn Iterator<Item = Result<mcap::Message, mcap::McapError>>>> = None;

#[wasm_bindgen]
pub fn init(buf: &js_sys::Uint8Array) -> Result<(), JsValue> {
    unsafe {
        BUFFER = buf.to_vec();
        STREAM = Some(Box::new(mcap::MessageStream::new(&BUFFER).unwrap()));
    }

    Ok(())
}

#[wasm_bindgen]
pub fn read_messages(max_num_msgs: usize) -> Result<Vec<RawMessage>, JsError> {
    let mut ret: Vec<RawMessage> = Vec::with_capacity(max_num_msgs);
    let mut count = 0;

    unsafe {
        if let Some(stream) = &mut STREAM {

            while count < max_num_msgs {
                if let Some(result) = stream.next() {
                    if let Ok(msg) = result {
                        let data = match msg.data {
                            std::borrow::Cow::Borrowed(buf) => {
                                let foo = js_sys::Uint8Array::new_with_length(
                                    u32::try_from(buf.len()).unwrap(),
                                );
                                foo.copy_from(&buf);
                                foo
                            }
                            std::borrow::Cow::Owned(buf) => {
                                let foo = js_sys::Uint8Array::new_with_length(
                                    u32::try_from(buf.len()).unwrap(),
                                );
                                foo.copy_from(&buf.as_slice());
                                foo
                            }
                        };

                        ret.push(RawMessage {
                            header: MessageHeader {
                                channel_id: 0,
                                log_time: 0,
                                publish_time: 0,
                                sequence: 0,
                            },
                            data: data,
                        });

                        count += 1;
                    }
                } else {
                    break; // Iterator at the end.
                }
            }
        } else {
            return Err(JsError::new("Iterator not initialized!"));
        }
    }

    Ok(ret)
}
