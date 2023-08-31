import React, { FC, useRef, useEffect } from 'react';
import { Input, Button } from 'antd';
import { ModalBox } from './ModalBox'; // assuming ModalBox and InputBox are in the same directory

export interface InputBoxProps {
    visible: boolean;
    title?: React.ReactNode;
    onClose: () => void;
    onSubmit: (value: string) => void;
    className?: string;
    width?: string | number;
    loading?: boolean;
    mask?: boolean;
    modalRender?: any;
    getContainer?: any;
    initialValue?: string;
}

export const InputBox: FC<InputBoxProps> = ({ 
    visible, 
    title, 
    onClose, 
    onSubmit, 
    className, 
    width,
    mask,
    getContainer,
    initialValue
}) => {
    const [inputValue, setInputValue] = React.useState<string>(initialValue || '');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleSubmit = () => {
        onSubmit(inputValue);
    };

    const textRef = useRef<any>(null);
    textRef?.current?.focus();

    useEffect(() => {
        textRef?.current?.focus();
    }, [visible]);

    return (
        <ModalBox 
            visible={visible}
            title={title}
            onClose={onClose}
            className={className}
            width={width}
            loading={false}
            mask={mask}
            getContainer={getContainer}
        >
            <table style={{
                width: '100%'
            }}>
                <tr>
                    <td>
                        <Input ref={textRef} 
                               value={inputValue} 
                               onChange={handleInputChange} 
                               className='ant-input' />
                    </td>
                </tr>
                <tr>
                    <td style={{ height: '10px' }}>
                    </td>
                </tr>
                <tr>
                    <td style={{
                        textAlign: 'right'
                    }}>
                        <Button disabled={!inputValue || inputValue.trim().length == 0} 
                                type='primary' 
                                onClick={handleSubmit} 
                                autoFocus={true}
                        >Submit</Button>
                    </td>
                </tr>
            </table>            
        </ModalBox>
    );
}
